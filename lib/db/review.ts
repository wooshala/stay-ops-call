import { getCallById } from "@/lib/db/calls";
import { listBatchJobItems } from "@/lib/db/batchJobs";
import { buildClusterKey } from "@/lib/review/cluster";
import {
  computeReviewPriorityScoreAndReasons,
  isLikelyFallback,
} from "@/lib/review/scoring";
import { getServiceSupabase } from "@/lib/supabase/server";
import type {
  CallRow,
  ReviewCandidateRow,
  ReviewClusterRow,
  ReviewJobRow,
  ReviewJobStatus,
  ReviewLabelRow,
} from "@/lib/types/database";

export async function createReviewJob(input: {
  title: string;
  source_batch_job_id?: string | null;
}): Promise<ReviewJobRow> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_jobs")
    .insert({
      title: input.title,
      source_batch_job_id: input.source_batch_job_id ?? null,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ReviewJobRow;
}

export async function listReviewJobs(limit = 50): Promise<ReviewJobRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[review] listReviewJobs:", error.message);
    return [];
  }
  return (data ?? []) as ReviewJobRow[];
}

export async function getReviewJob(id: string): Promise<ReviewJobRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[review] getReviewJob:", error.message);
    return null;
  }
  return data as ReviewJobRow | null;
}

export async function updateReviewJobStatus(
  id: string,
  status: ReviewJobStatus,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("review_jobs")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function importCallsFromBatchJob(
  reviewJobId: string,
  batchJobId: string,
): Promise<number> {
  const supabase = getServiceSupabase();

  const { data: byCol, error: colErr } = await supabase
    .from("calls")
    .select("id")
    .eq("batch_job_id", batchJobId);
  if (colErr) throw colErr;

  let callIds = (byCol ?? []).map((r) => (r as { id: string }).id);

  if (callIds.length === 0) {
    const items = await listBatchJobItems(batchJobId);
    callIds = [
      ...new Set(
        items
          .map((i) => i.call_id)
          .filter((id): id is string => id != null && id !== ""),
      ),
    ];
  }

  if (callIds.length === 0) return 0;

  const rows = callIds.map((call_id) => ({
    review_job_id: reviewJobId,
    call_id,
  }));
  const { error } = await supabase.from("review_job_calls").upsert(rows, {
    onConflict: "review_job_id,call_id",
  });
  if (error) throw error;

  await supabase
    .from("review_jobs")
    .update({ source_batch_job_id: batchJobId, status: "imported" })
    .eq("id", reviewJobId);

  return callIds.length;
}

export async function listCallIdsForReviewJob(
  reviewJobId: string,
): Promise<string[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_job_calls")
    .select("call_id")
    .eq("review_job_id", reviewJobId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { call_id: string }).call_id);
}

export interface ReviewJobStats {
  total_calls: number;
  analyzed_count: number;
  /** 분석 대기·진행·실패 등 아직 끝나지 않은 건 */
  pending_analysis_count: number;
  candidate_count: number;
  cluster_count: number;
  labeled_count: number;
  representative_count: number;
}

export async function getReviewJobStats(
  reviewJobId: string,
): Promise<ReviewJobStats> {
  const supabase = getServiceSupabase();
  const callIds = await listCallIdsForReviewJob(reviewJobId);
  const total_calls = callIds.length;

  let analyzed_count = 0;
  let pending_analysis_count = 0;
  for (const cid of callIds) {
    const c = await getCallById(cid);
    const st = c?.analysis_status;
    if (
      st &&
      ["completed", "partial", "warning", "skipped"].includes(st)
    ) {
      analyzed_count++;
    }
    if (
      !st ||
      st === "queued" ||
      st === "pending" ||
      st === "processing" ||
      st === "failed"
    ) {
      pending_analysis_count++;
    }
  }

  const { count: candN } = await supabase
    .from("review_candidates")
    .select("*", { count: "exact", head: true })
    .eq("review_job_id", reviewJobId);

  const { count: clN } = await supabase
    .from("review_clusters")
    .select("*", { count: "exact", head: true })
    .eq("review_job_id", reviewJobId);

  const { count: labeledN } = await supabase
    .from("review_candidates")
    .select("*", { count: "exact", head: true })
    .eq("review_job_id", reviewJobId)
    .eq("review_status", "labeled");

  const { count: repN } = await supabase
    .from("review_candidates")
    .select("*", { count: "exact", head: true })
    .eq("review_job_id", reviewJobId)
    .eq("is_representative", true);

  return {
    total_calls,
    analyzed_count,
    pending_analysis_count,
    candidate_count: candN ?? 0,
    cluster_count: clN ?? 0,
    labeled_count: labeledN ?? 0,
    representative_count: repN ?? 0,
  };
}

export async function deleteCandidatesForJob(reviewJobId: string): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase.from("review_clusters").delete().eq("review_job_id", reviewJobId);
  await supabase.from("review_candidates").delete().eq("review_job_id", reviewJobId);
}

const DEFAULT_TOP_N = 400;

export async function extractReviewCandidates(
  reviewJobId: string,
  options?: { topN?: number },
): Promise<number> {
  await deleteCandidatesForJob(reviewJobId);
  const topN = Math.min(
    2000,
    Math.max(1, options?.topN ?? DEFAULT_TOP_N),
  );
  const callIds = await listCallIdsForReviewJob(reviewJobId);
  const supabase = getServiceSupabase();
  const scored: Array<{
    review_job_id: string;
    call_id: string;
    review_priority_score: number;
    cluster_key: null;
    predicted_call_type: string | null;
    intent_score: number | null;
    is_fallback: boolean;
    review_status: "pending";
    is_representative: boolean;
    reason_json: Record<string, number>;
  }> = [];

  for (const callId of callIds) {
    const call = await getCallById(callId);
    if (!call) continue;
    if (
      !call.analysis_status ||
      call.analysis_status === "queued" ||
      call.analysis_status === "pending" ||
      call.analysis_status === "processing" ||
      call.analysis_status === "failed"
    ) {
      continue;
    }
    const { score, reasons } = computeReviewPriorityScoreAndReasons(call);
    scored.push({
      review_job_id: reviewJobId,
      call_id: callId,
      review_priority_score: score,
      cluster_key: null,
      predicted_call_type: call.primary_intent,
      intent_score: call.analysis_confidence,
      is_fallback: isLikelyFallback(call),
      review_status: "pending",
      is_representative: false,
      reason_json: reasons,
    });
  }

  scored.sort((a, b) => b.review_priority_score - a.review_priority_score);
  const rows = scored.slice(0, topN);

  if (rows.length === 0) {
    await updateReviewJobStatus(reviewJobId, "analyzed");
    return 0;
  }

  const { error } = await supabase.from("review_candidates").insert(rows);
  if (error) throw error;
  await updateReviewJobStatus(reviewJobId, "candidates_ready");
  return rows.length;
}

const DEFAULT_REPS_PER_CLUSTER = 3;

export async function buildReviewClusters(
  reviewJobId: string,
  options?: { repsPerCluster?: number },
): Promise<number> {
  const repsPerCluster = Math.min(
    10,
    Math.max(1, options?.repsPerCluster ?? DEFAULT_REPS_PER_CLUSTER),
  );
  const supabase = getServiceSupabase();
  const { data: cands, error } = await supabase
    .from("review_candidates")
    .select("id, call_id, review_priority_score")
    .eq("review_job_id", reviewJobId);
  if (error) throw error;

  const list = (cands ?? []) as Array<{
    id: string;
    call_id: string;
    review_priority_score: number;
  }>;

  const byKey = new Map<
    string,
    Array<{ id: string; call_id: string; review_priority_score: number }>
  >();

  for (const c of list) {
    const call = await getCallById(c.call_id);
    if (!call) continue;
    const key = buildClusterKey(call);
    const arr = byKey.get(key) ?? [];
    arr.push(c);
    byKey.set(key, arr);
  }

  await supabase
    .from("review_candidates")
    .update({ cluster_key: null, is_representative: false })
    .eq("review_job_id", reviewJobId);

  await supabase.from("review_clusters").delete().eq("review_job_id", reviewJobId);

  let clusterNum = 0;
  for (const [cluster_key, members] of byKey) {
    members.sort((a, b) => b.review_priority_score - a.review_priority_score);
    const repIds = new Set(
      members.slice(0, repsPerCluster).map((m) => m.id),
    );
    const primaryRep = members[0]!;
    for (const m of members) {
      await supabase
        .from("review_candidates")
        .update({
          cluster_key,
          is_representative: repIds.has(m.id),
        })
        .eq("id", m.id);
    }
    await supabase.from("review_clusters").insert({
      review_job_id: reviewJobId,
      cluster_key,
      representative_candidate_id: primaryRep.id,
      sample_count: members.length,
    });
    clusterNum++;
  }

  await updateReviewJobStatus(reviewJobId, "clustered");
  return clusterNum;
}

export type CandidateFilter =
  | ""
  | "warning_only"
  | "partial_only"
  | "other_only"
  | "fallback_only"
  | "pending_only";

export async function listReviewCandidatesWithCalls(
  reviewJobId: string,
  filter: CandidateFilter,
): Promise<
  Array<
    ReviewCandidateRow & {
      call: CallRow;
    }
  >
> {
  const supabase = getServiceSupabase();
  let q = supabase
    .from("review_candidates")
    .select("*")
    .eq("review_job_id", reviewJobId)
    .order("review_priority_score", { ascending: false });

  if (filter === "pending_only") {
    q = q.eq("review_status", "pending");
  }

  const { data, error } = await q;
  if (error) throw error;
  const cands = (data ?? []) as ReviewCandidateRow[];

  const out: Array<ReviewCandidateRow & { call: CallRow }> = [];
  for (const c of cands) {
    const call = await getCallById(c.call_id);
    if (!call) continue;

    if (filter === "warning_only" && call.analysis_status !== "warning") {
      continue;
    }
    if (filter === "partial_only" && call.analysis_status !== "partial") {
      continue;
    }
    if (
      filter === "other_only" &&
      (call.primary_intent ?? "") !== "other"
    ) {
      continue;
    }
    if (filter === "fallback_only" && !c.is_fallback) {
      continue;
    }

    out.push({ ...c, call });
  }

  if (filter === "pending_only") {
    out.sort((a, b) => {
      if (a.is_representative !== b.is_representative) {
        return a.is_representative ? -1 : 1;
      }
      return b.review_priority_score - a.review_priority_score;
    });
  }

  return out;
}

export async function getReviewCandidateById(
  id: string,
): Promise<(ReviewCandidateRow & { call: CallRow }) | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ReviewCandidateRow;
  const call = await getCallById(row.call_id);
  if (!call) return null;
  return { ...row, call };
}

export async function getLabelForCandidate(
  candidateId: string,
): Promise<ReviewLabelRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_labels")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (error) {
    console.warn("[review] getLabelForCandidate:", error.message);
    return null;
  }
  return data as ReviewLabelRow | null;
}

export async function upsertReviewLabel(input: {
  candidate_id: string;
  final_call_type: string | null;
  final_summary: string | null;
  final_price_mentioned?: boolean | null;
  final_date_mentioned?: boolean | null;
  final_requires_followup?: boolean | null;
  final_should_create_record?: boolean | null;
  reviewer_type?: "human" | "ai" | "hybrid" | null;
  reviewer_note: string | null;
}): Promise<ReviewLabelRow> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_labels")
    .upsert(
      {
        candidate_id: input.candidate_id,
        final_call_type: input.final_call_type,
        final_summary: input.final_summary,
        final_price_mentioned: input.final_price_mentioned ?? null,
        final_date_mentioned: input.final_date_mentioned ?? null,
        final_requires_followup: input.final_requires_followup ?? null,
        final_should_create_record: input.final_should_create_record ?? null,
        reviewer_type: input.reviewer_type ?? "human",
        reviewer_note: input.reviewer_note,
      },
      { onConflict: "candidate_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ReviewLabelRow;
}

export async function markCandidateStatus(
  candidateId: string,
  status: "pending" | "skipped" | "labeled",
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("review_candidates")
    .update({ review_status: status })
    .eq("id", candidateId);
  if (error) throw error;
}

export async function listReviewLinksForCall(
  callId: string,
): Promise<
  Array<{
    job: ReviewJobRow;
    candidate: ReviewCandidateRow;
    label: ReviewLabelRow | null;
  }>
> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_candidates")
    .select("*")
    .eq("call_id", callId);
  if (error) {
    console.warn("[review] listReviewLinksForCall:", error.message);
    return [];
  }
  const out: Array<{
    job: ReviewJobRow;
    candidate: ReviewCandidateRow;
    label: ReviewLabelRow | null;
  }> = [];
  for (const row of data ?? []) {
    const c = row as ReviewCandidateRow;
    const job = await getReviewJob(c.review_job_id);
    if (!job) continue;
    const label = await getLabelForCandidate(c.id);
    out.push({ job, candidate: c, label });
  }
  return out;
}

export async function ensureReviewJobCall(
  reviewJobId: string,
  callId: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("review_job_calls").upsert(
    { review_job_id: reviewJobId, call_id: callId },
    { onConflict: "review_job_id,call_id" },
  );
  if (error) throw error;
}

/**
 * 통화 상세에서 검수 연결 시: 후보가 없으면 생성(점수·reason_json 포함).
 */
export async function findOrCreateReviewCandidateForCall(
  reviewJobId: string,
  callId: string,
): Promise<ReviewCandidateRow> {
  const supabase = getServiceSupabase();
  const { data: existing, error: exErr } = await supabase
    .from("review_candidates")
    .select("*")
    .eq("review_job_id", reviewJobId)
    .eq("call_id", callId)
    .maybeSingle();
  if (exErr) throw exErr;
  if (existing) return existing as ReviewCandidateRow;

  const call = await getCallById(callId);
  if (!call) throw new Error("Call not found");

  const { score, reasons } = computeReviewPriorityScoreAndReasons(call);
  const { data, error } = await supabase
    .from("review_candidates")
    .insert({
      review_job_id: reviewJobId,
      call_id: callId,
      review_priority_score: score,
      cluster_key: null,
      predicted_call_type: call.primary_intent,
      intent_score: call.analysis_confidence,
      is_fallback: isLikelyFallback(call),
      review_status: "pending",
      is_representative: false,
      reason_json: reasons,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ReviewCandidateRow;
}

export async function listRecentBatchJobs(limit = 30): Promise<
  Array<{
    id: string;
    name: string | null;
    pipeline: string;
    status: string;
    created_at: string;
    total_count: number;
  }>
> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("batch_jobs")
    .select("id, name, pipeline, status, created_at, total_count")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    name: string | null;
    pipeline: string;
    status: string;
    created_at: string;
    total_count: number;
  }>;
}

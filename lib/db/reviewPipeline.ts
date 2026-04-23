import { randomUUID } from "crypto";

import { isMissingColumnOrRelationError } from "@/lib/supabase/columnError";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallRow } from "@/lib/types/database";

export type ReviewStatus = "raw" | "needs_review" | "verified" | "rejected";
export type LabelStatus = "none" | "auto" | "human_verified";

export type ReviewPipelineStatus = "raw" | "needs_review" | "verified" | "rejected";

export type ReviewPipelineRow = {
  id: string;
  source_file_name: string | null;
  file_size_kb: number | null;
  note: string | null;
  file_fingerprint: string | null;
  batch_job_id: string | null;
  analysis_status: string | null;
  analysis_error_code: string | null;
  analysis_error_message: string | null;
  primary_intent: string | null;
  confidence: number | null;
  analysis_confidence: number | null;
  auto_score?: number | null;
  auto_decision?: "pass" | "reject" | "review" | null;
  cluster_id?: string | null;
  review_status: ReviewStatus | null;
  label_status: LabelStatus | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  entity_checkin_date?: string | null;
  entity_people_count?: number | null;
  created_at: string;
  updated_at: string;
};

export type ReviewPipelineCounts = {
  total: number;
  raw: number;
  needs_review: number;
  verified: number;
  rejected: number;
  failed: number;
};

export async function getReviewSchemaFlags(): Promise<{
  sourceFileName: boolean;
  reviewColumns: boolean;
  fingerprint: boolean;
}> {
  const supabase = getServiceSupabase();

  const sourceProbe = await supabase.from("calls").select("source_file_name").limit(1);
  const sourceFileName = !sourceProbe.error;

  const reviewProbe = await supabase
    .from("calls")
    .select("review_status,label_status,reviewed_at,reviewed_by")
    .limit(1);
  const reviewColumns = !reviewProbe.error;

  const fpProbe = await supabase.from("calls").select("file_fingerprint").limit(1);
  const fingerprint = !fpProbe.error;

  return { sourceFileName, reviewColumns, fingerprint };
}

export async function findCallByFingerprint(
  fingerprint: string,
): Promise<ReviewPipelineRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("file_fingerprint", fingerprint)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnOrRelationError(error)) return null;
    throw error;
  }

  return (data as ReviewPipelineRow | null) ?? null;
}

export async function createReviewCall(input: {
  source_file_name: string;
  file_fingerprint: string;
  file_size_kb?: number | null;
  batch_job_id?: string | null;
}): Promise<CallRow> {
  const supabase = getServiceSupabase();
  const row: Record<string, unknown> = {
    id: randomUUID(),
    started_at: null,
    ended_at: null,
    duration_sec: null,
    phone_number: null,
    normalized_phone: null,
    direction: "inbound",
    source_type: "internal",
    room_no_hint: null,
    recording_path: null,
    recording_url: null,
    note: `file-review: ${input.source_file_name}`,
    upload_status: "uploaded",
    stt_status: "pending",
    analysis_status: "queued",
    batch_job_id: input.batch_job_id ?? null,
    source_file_name: input.source_file_name,
    file_fingerprint: input.file_fingerprint,
    file_size_kb: input.file_size_kb ?? null,
    review_status: "raw",
    label_status: "none",
  };

  const first = await supabase.from("calls").insert(row).select("*").single();
  if (!first.error) return first.data as CallRow;

  if (!isMissingColumnOrRelationError(first.error)) {
    throw first.error;
  }

  // schema not fully migrated: keep minimal insert and fail safe mode upstream
  const compat: Record<string, unknown> = {
    id: row.id,
    started_at: null,
    ended_at: null,
    duration_sec: null,
    phone_number: null,
    normalized_phone: null,
    direction: "inbound",
    source_type: "internal",
    room_no_hint: null,
    recording_path: null,
    recording_url: null,
    note: row.note,
    upload_status: "uploaded",
    stt_status: "pending",
    analysis_status: "queued",
    batch_job_id: input.batch_job_id ?? null,
  };
  const second = await supabase.from("calls").insert(compat).select("*").single();
  if (second.error) throw second.error;
  return second.data as CallRow;
}

export async function markCallQueuedForAnalyze(
  callId: string,
  batchJobId: string,
  fileSizeKb?: number | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      batch_job_id: batchJobId,
      analysis_status: "queued",
      analysis_error_code: null,
      analysis_error_message: null,
      file_size_kb: fileSizeKb ?? null,
      review_status: "raw",
      label_status: "none",
      reviewed_at: null,
      reviewed_by: null,
    })
    .eq("id", callId);
  if (error) {
    if (isMissingColumnOrRelationError(error)) {
      const { error: compatErr } = await supabase
        .from("calls")
        .update({
          batch_job_id: batchJobId,
          analysis_status: "queued",
          analysis_error_code: null,
          analysis_error_message: null,
        })
        .eq("id", callId);
      if (compatErr) throw compatErr;
      return;
    }
    throw error;
  }
}

export async function listReviewPipeline(params: {
  statuses: ReviewPipelineStatus[];
  includeRejected?: boolean;
}): Promise<{ rows: ReviewPipelineRow[]; counts: ReviewPipelineCounts }> {
  const supabase = getServiceSupabase();
  const flags = await getReviewSchemaFlags();
  if (!flags.reviewColumns) {
    return {
      rows: [],
      counts: { total: 0, raw: 0, needs_review: 0, verified: 0, rejected: 0, failed: 0 },
    };
  }

  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const all = (data ?? []) as ReviewPipelineRow[];
  const ids = all.map((r) => r.id);
  const entityMap = new Map<string, { checkin_date: string | null; occupancy_count: number | null }>();
  if (ids.length > 0) {
    const entRes = await supabase
      .from("call_entities")
      .select("call_id,checkin_date,occupancy_count,created_at")
      .in("call_id", ids)
      .order("created_at", { ascending: false });
    if (!entRes.error) {
      for (const e of entRes.data ?? []) {
        if (!entityMap.has(e.call_id)) {
          entityMap.set(e.call_id, {
            checkin_date: e.checkin_date ?? null,
            occupancy_count: e.occupancy_count ?? null,
          });
        }
      }
    } else if (!isMissingColumnOrRelationError(entRes.error)) {
      throw entRes.error;
    }
  }
  const counts: ReviewPipelineCounts = {
    total: all.length,
    raw: 0,
    needs_review: 0,
    verified: 0,
    rejected: 0,
    failed: 0,
  };

  for (const r of all) {
    if (r.review_status === "raw") counts.raw++;
    if (
      r.review_status === "needs_review" ||
      r.analysis_status === "failed" ||
      r.label_status === "auto"
    ) {
      counts.needs_review++;
    }
    if (r.review_status === "verified" && r.label_status === "human_verified") {
      counts.verified++;
    }
    if (r.review_status === "rejected") counts.rejected++;
    if (r.analysis_status === "failed") counts.failed++;
  }

  const want = new Set(params.statuses);
  const rows = all.filter((r) => {
    const isRight = r.review_status === "verified" && r.label_status === "human_verified";
    if (isRight) return want.has("verified");

    if (r.review_status === "rejected") {
      return Boolean(params.includeRejected) && want.has("rejected");
    }

    if (r.review_status === "raw") return want.has("raw");

    const isNeeds =
      r.review_status === "needs_review" ||
      r.analysis_status === "failed" ||
      r.label_status === "auto";
    if (isNeeds) return want.has("needs_review");

    return false;
  });

  const enrichedRows = rows.map((r) => {
    const ent = entityMap.get(r.id);
    return {
      ...r,
      entity_checkin_date: ent?.checkin_date ?? null,
      entity_people_count: ent?.occupancy_count ?? null,
    };
  });

  return { rows: enrichedRows, counts };
}

export async function insertReviewLog(input: {
  call_id: string;
  action: string;
  before_json?: unknown;
  after_json?: unknown;
  created_by?: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  const row: Record<string, unknown> = {
    call_id: input.call_id,
    action: input.action,
    before_json: input.before_json ?? null,
    after_json: input.after_json ?? null,
    created_by: input.created_by ?? "system",
  };
  const { error } = await supabase.from("review_logs").insert(row);
  if (error) {
    if (isMissingColumnOrRelationError(error)) {
      console.warn("[review_logs] missing relation/column, skip insert", error.message);
      return;
    }
    throw error;
  }
}

export async function updateReviewState(input: {
  callId: string;
  action: "save" | "verify" | "reject" | "reanalyze";
  reviewedBy?: string | null;
  patch?: {
    summary?: string | null;
    primary_intent?: string | null;
    review_note?: string | null;
    checkin_date?: string | null;
    checkout_date?: string | null;
    amount?: number | null;
    room_no?: string | null;
    issue_type?: string | null;
  };
}): Promise<void> {
  const supabase = getServiceSupabase();
  const { data: before } = await supabase
    .from("calls")
    .select("id,review_status,label_status,reviewed_at,reviewed_by,summary,primary_intent,note")
    .eq("id", input.callId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  if (input.patch?.summary !== undefined) patch.summary = input.patch.summary;
  if (input.patch?.primary_intent !== undefined) {
    patch.primary_intent = input.patch.primary_intent;
  }
  if (input.patch?.review_note !== undefined) {
    patch.note = input.patch.review_note;
  }

  if (input.action === "verify") {
    patch.review_status = "verified";
    patch.label_status = "human_verified";
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = (input.reviewedBy?.trim() || "system");
  } else if (input.action === "reject") {
    patch.analysis_status = "failed";
    patch.analysis_error_code = "manual_reject";
    patch.analysis_error_message = "reviewer rejected";
    patch.review_status = "rejected";
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = (input.reviewedBy?.trim() || "system");
  } else if (input.action === "reanalyze") {
    patch.review_status = "raw";
    patch.label_status = "none";
    patch.analysis_status = "queued";
    patch.reviewed_at = null;
    patch.reviewed_by = null;
  }

  const { error } = await supabase.from("calls").update(patch).eq("id", input.callId);
  if (error) {
    if (isMissingColumnOrRelationError(error)) {
      const compatPatch: Record<string, unknown> = {};
      if (patch.summary !== undefined) compatPatch.summary = patch.summary;
      if (patch.primary_intent !== undefined) compatPatch.primary_intent = patch.primary_intent;
      if (patch.note !== undefined) compatPatch.note = patch.note;
      const { error: e2 } = await supabase
        .from("calls")
        .update(compatPatch)
        .eq("id", input.callId);
      if (e2) throw e2;
    } else {
      throw error;
    }
  }

  const entityPatch: Record<string, unknown> = {};
  if (input.patch?.checkin_date !== undefined) entityPatch.checkin_date = input.patch.checkin_date;
  if (input.patch?.checkout_date !== undefined) entityPatch.checkout_date = input.patch.checkout_date;
  if (input.patch?.amount !== undefined) entityPatch.amount = input.patch.amount;
  if (input.patch?.room_no !== undefined) entityPatch.room_no = input.patch.room_no;
  if (input.patch?.issue_type !== undefined) entityPatch.issue_type = input.patch.issue_type;
  if (Object.keys(entityPatch).length > 0) {
    const current = await supabase
      .from("call_entities")
      .select("id")
      .eq("call_id", input.callId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!current.error && current.data?.id) {
      await supabase.from("call_entities").update(entityPatch).eq("id", current.data.id);
    }
  }

  const actionName =
    input.action === "save"
      ? "review_save"
      : input.action === "verify"
        ? "review_complete"
        : input.action === "reanalyze"
          ? "re_analyze"
          : "review_reject";
  await insertReviewLog({
    call_id: input.callId,
    action: actionName,
    before_json: before ?? null,
    after_json: patch,
    created_by: input.reviewedBy?.trim() || "system",
  });
}

import { analysisStatusIsUsableForWorkflow } from "@/lib/db/calls";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallRow } from "@/lib/types/database";
import { isLikelyFallback } from "@/lib/review/scoring";

export type CallDataReviewState = "none" | "candidate" | "labeled";

export interface CallDataRow {
  id: string;
  created_at: string;
  phone_e164: string | null;
  duration_sec: number | null;
  analysis_status: string | null;
  analysis_error_code: string | null;
  analysis_error_message: string | null;
  call_type: string | null;
  intent_score: number | null;
  is_fallback: boolean;
  review: CallDataReviewState;
  batch_job_id: string | null;
}

export interface ListCallsDataViewerParams {
  dateFrom?: string;
  dateTo?: string;
  analysisStatus?: string;
  /** completed | partial | warning (라벨링 가능 구간) */
  analysisUsable?: boolean;
  /** pending | processing */
  analysisPending?: boolean;
  callType?: string;
  batchId?: string;
  review?: "any" | "labeled" | "unlabeled";
  page: number;
  pageSize: number;
}

const MAX_FETCH = 4000;

async function getReviewStateForCalls(
  callIds: string[],
): Promise<Map<string, CallDataReviewState>> {
  if (callIds.length === 0) return new Map();
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_candidates")
    .select("call_id, review_status")
    .in("call_id", callIds);
  if (error) throw error;
  const map = new Map<string, CallDataReviewState>();
  for (const row of data ?? []) {
    const r = row as { call_id: string; review_status: string };
    const prev = map.get(r.call_id) ?? "none";
    if (r.review_status === "labeled") {
      map.set(r.call_id, "labeled");
    } else if (prev !== "labeled") {
      map.set(r.call_id, "candidate");
    }
  }
  return map;
}

function toRow(
  c: CallRow,
  review: CallDataReviewState,
): CallDataRow {
  return {
    id: c.id,
    created_at: c.created_at,
    phone_e164: c.normalized_phone ?? c.phone_number,
    duration_sec: c.duration_sec,
    analysis_status: c.analysis_status,
    analysis_error_code: c.analysis_error_code ?? null,
    analysis_error_message: c.analysis_error_message ?? null,
    call_type: c.primary_intent,
    intent_score: c.analysis_confidence,
    is_fallback: isLikelyFallback(c),
    review,
    batch_job_id: c.batch_job_id ?? null,
  };
}

/**
 * 통화 데이터 뷰어: 필터 후 메모리에서 페이지네이션 (최대 MAX_FETCH 건).
 */
export async function listCallsDataViewer(
  params: ListCallsDataViewerParams,
): Promise<{ rows: CallDataRow[]; total: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));

  const supabase = getServiceSupabase();

  const buildBaseQuery = () => {
    let q = supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_FETCH);

    if (params.dateFrom) {
      q = q.gte("created_at", params.dateFrom);
    }
    if (params.dateTo) {
      const end = params.dateTo.includes("T")
        ? params.dateTo
        : `${params.dateTo}T23:59:59.999Z`;
      q = q.lte("created_at", end);
    }
    if (params.analysisStatus) {
      q = q.eq("analysis_status", params.analysisStatus);
    }
    if (params.callType) {
      q = q.eq("primary_intent", params.callType);
    }
    return q;
  };

  let q = buildBaseQuery();
  if (params.batchId) {
    q = q.eq("batch_job_id", params.batchId);
  }

  const { data, error } = await q;
  if (error) throw error;

  let calls = (data ?? []) as CallRow[];
  const ids = calls.map((c) => c.id);

  const reviewMap = await getReviewStateForCalls(ids);

  const merged: CallDataRow[] = [];
  for (const c of calls) {
    const rev = reviewMap.get(c.id) ?? "none";
    if (params.review === "labeled" && rev !== "labeled") continue;
    if (params.review === "unlabeled" && rev === "labeled") continue;
    if (params.analysisUsable && !analysisStatusIsUsableForWorkflow(c.analysis_status)) {
      continue;
    }
    if (
      params.analysisPending &&
      c.analysis_status !== "queued" &&
      c.analysis_status !== "pending" &&
      c.analysis_status !== "processing"
    ) {
      continue;
    }
    merged.push(toRow(c, rev));
  }

  const total = merged.length;
  const from = (page - 1) * pageSize;
  const rows = merged.slice(from, from + pageSize);

  return { rows, total };
}

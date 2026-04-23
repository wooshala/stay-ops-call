import { analysisStatusIsUsableForWorkflow } from "@/lib/db/calls";
import {
  getBatchJob,
  listBatchJobItems,
} from "@/lib/db/batchJobs";
import { listExcludedFileNames } from "@/lib/db/reviewFileState";
import { isMissingColumnOrRelationError } from "@/lib/supabase/columnError";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { BatchJobItemRow, BatchJobRow } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FailureReasonAgg = {
  key: string;
  analysis_error_code: string | null;
  analysis_error_message: string | null;
  error_stage: string | null;
  error_message: string | null;
  count: number;
};

export type BatchJobReviewOutcome = {
  selected_count: number;
  completed_count: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  job_status: string;
  /** 배치 잡이 종료됨 (completed 또는 failed) */
  job_finished: boolean;
  /** calls.batch_job_id 기준 라벨링에 쓸 수 있는 건수 */
  label_ready_count: number;
  has_label_ready: boolean;
  /** calls 기준 분석 실패 */
  call_failed_count: number;
  /** calls 기준 대기·진행 */
  call_pending_count: number;
  /** Step 4 — 이번 잡 파일 중 제외된 파일 수 */
  excluded_in_job_scope: number;
  top_failure_reasons: FailureReasonAgg[];
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().slice(0, 500);
}

type CallRowForOutcome = {
  id: string;
  analysis_status: string | null;
  analysis_error_code?: string | null;
  analysis_error_message: string | null;
  source_file_name?: string | null;
};

/**
 * calls.batch_job_id / source_file_name 컬럼이 없을 때 batch_job_items로 조인 폴백.
 */
async function fetchCallsForBatchJobOutcome(
  supabase: SupabaseClient,
  jobId: string,
): Promise<CallRowForOutcome[]> {
  const full = await supabase
    .from("calls")
    .select(
      "id, analysis_status, analysis_error_code, analysis_error_message, source_file_name",
    )
    .eq("batch_job_id", jobId);

  if (!full.error) {
    return (full.data ?? []) as CallRowForOutcome[];
  }

  if (!isMissingColumnOrRelationError(full.error)) {
    console.warn("[reviewOutcome] calls", full.error.message);
    return [];
  }

  const noSource = await supabase
    .from("calls")
    .select(
      "id, analysis_status, analysis_error_code, analysis_error_message",
    )
    .eq("batch_job_id", jobId);

  if (!noSource.error) {
    return (noSource.data ?? []) as CallRowForOutcome[];
  }

  if (!isMissingColumnOrRelationError(noSource.error)) {
    console.warn("[reviewOutcome] calls", noSource.error.message);
    return [];
  }

  const { data: itemRows, error: itemErr } = await supabase
    .from("batch_job_items")
    .select("call_id")
    .eq("batch_job_id", jobId)
    .not("call_id", "is", null);
  if (itemErr) {
    console.warn("[reviewOutcome] batch_job_items", itemErr.message);
    return [];
  }
  const ids = [
    ...new Set(
      (itemRows ?? [])
        .map((r) => (r as { call_id: string }).call_id)
        .filter((id): id is string => id != null && id !== ""),
    ),
  ];
  if (ids.length === 0) return [];

  const byIds = await supabase
    .from("calls")
    .select(
      "id, analysis_status, analysis_error_code, analysis_error_message",
    )
    .in("id", ids);
  if (byIds.error) {
    console.warn("[reviewOutcome] calls by ids", byIds.error.message);
    return [];
  }
  return (byIds.data ?? []) as CallRowForOutcome[];
}

function bump(
  map: Map<string, FailureReasonAgg>,
  key: string,
  patch: Omit<FailureReasonAgg, "key" | "count">,
) {
  const cur = map.get(key);
  if (cur) {
    cur.count += 1;
    return;
  }
  map.set(key, {
    key,
    count: 1,
    ...patch,
  });
}

/**
 * 파일 검수 Step 3·4용: 배치 1건에 대한 성공/실패/대기·상위 실패 원인.
 */
export async function getBatchJobReviewOutcome(
  jobId: string,
): Promise<BatchJobReviewOutcome | null> {
  const job = await getBatchJob(jobId);
  if (!job) return null;

  const items = await listBatchJobItems(jobId);
  const excludedSet = await listExcludedFileNames();

  const o = buildOutcomeFromJobAndItems(job, items, excludedSet);
  const supabase = getServiceSupabase();
  const calls = await fetchCallsForBatchJobOutcome(supabase, jobId);

  let label_ready_count = 0;
  let call_failed_count = 0;
  let call_pending_count = 0;

  for (const c of calls) {
    if (analysisStatusIsUsableForWorkflow(c.analysis_status)) {
      label_ready_count++;
    }
    if (c.analysis_status === "failed") {
      call_failed_count++;
    }
    if (
      c.analysis_status === "queued" ||
      c.analysis_status === "pending" ||
      c.analysis_status === "processing"
    ) {
      call_pending_count++;
    }
  }

  const failMap = new Map<string, FailureReasonAgg>();
  for (const it of items) {
    if (it.status !== "failed") continue;
    const stage = it.error_stage ?? null;
    const msg = it.error_message ?? null;
    const key = `item|${norm(stage)}|${norm(msg)}`;
    bump(failMap, key, {
      analysis_error_code: null,
      analysis_error_message: null,
      error_stage: stage,
      error_message: msg,
    });
  }

  for (const c of calls) {
    if (c.analysis_status !== "failed") continue;
    const code = c.analysis_error_code ?? null;
    const msg = c.analysis_error_message ?? null;
    const key = `call|${norm(code)}|${norm(msg)}`;
    bump(failMap, key, {
      analysis_error_code: code,
      analysis_error_message: msg,
      error_stage: null,
      error_message: null,
    });
  }

  const top_failure_reasons = [...failMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const itemNames = new Set(items.map((i) => i.file_name));
  let excluded_in_job_scope = 0;
  for (const name of itemNames) {
    if (excludedSet.has(name)) excluded_in_job_scope++;
  }

  return {
    ...o,
    label_ready_count,
    has_label_ready: label_ready_count > 0,
    call_failed_count,
    call_pending_count,
    excluded_in_job_scope,
    top_failure_reasons,
  };
}

function buildOutcomeFromJobAndItems(
  job: BatchJobRow,
  items: BatchJobItemRow[],
  excludedSet: Set<string>,
): BatchJobReviewOutcome {
  const selected_count = job.total_count;
  const completed_count = job.processed_count;
  const success_count = job.success_count;
  const failed_count = job.failed_count;
  const pending_count = Math.max(0, job.total_count - job.processed_count);
  const job_status = job.status;
  const job_finished = job_status === "completed" || job_status === "failed";

  const failMap = new Map<string, FailureReasonAgg>();
  for (const it of items) {
    if (it.status !== "failed") continue;
    const stage = it.error_stage ?? null;
    const msg = it.error_message ?? null;
    const key = `item|${norm(stage)}|${norm(msg)}`;
    bump(failMap, key, {
      analysis_error_code: null,
      analysis_error_message: null,
      error_stage: stage,
      error_message: msg,
    });
  }

  const top_failure_reasons = [...failMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  let excluded_in_job_scope = 0;
  const names = new Set(items.map((i) => i.file_name));
  for (const name of names) {
    if (excludedSet.has(name)) excluded_in_job_scope++;
  }

  return {
    selected_count,
    completed_count,
    success_count,
    failed_count,
    pending_count,
    job_status,
    job_finished,
    label_ready_count: 0,
    has_label_ready: false,
    call_failed_count: 0,
    call_pending_count: 0,
    excluded_in_job_scope,
    top_failure_reasons,
  };
}

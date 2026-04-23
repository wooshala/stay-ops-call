import { getServiceSupabase } from "@/lib/supabase/server";
import type { BatchJobRow, BatchJobItemRow } from "@/lib/types/database";

export async function createBatchJob(input: {
  pipeline: string;
  total_count: number;
  name?: string | null;
  uploadRoot?: string | null;
}): Promise<BatchJobRow> {
  const supabase = getServiceSupabase();
  const total = Math.max(0, input.total_count);
  const { data: job, error } = await supabase
    .from("batch_jobs")
    .insert({
      status: "queued",
      pipeline: input.pipeline,
      name: input.name ?? null,
      upload_root: input.uploadRoot ?? null,
      total_count: total,
      processed_count: 0,
      success_count: 0,
      failed_count: 0,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[batch_jobs] create", error);
    throw error;
  }
  return job as BatchJobRow;
}

export async function insertBatchJob(input: {
  pipeline: string;
  fileNames: string[];
  /** 표시용 (미입력 시 null) */
  name?: string | null;
  /** 워커가 파일을 읽을 절대 경로 (검수 업로드 폴더 등) */
  uploadRoot?: string | null;
}): Promise<{ job: BatchJobRow }> {
  const supabase = getServiceSupabase();
  const total = input.fileNames.length;

  const { data: job, error: jobErr } = await supabase
    .from("batch_jobs")
    .insert({
      status: "queued",
      pipeline: input.pipeline,
      name: input.name ?? null,
      upload_root: input.uploadRoot ?? null,
      total_count: total,
      processed_count: 0,
      success_count: 0,
      failed_count: 0,
    })
    .select("*")
    .single();

  if (jobErr) {
    console.error("[batch_jobs] insert", jobErr);
    throw jobErr;
  }

  const jobRow = job as BatchJobRow;

  if (total > 0) {
    const items = input.fileNames.map((file_name) => ({
      batch_job_id: jobRow.id,
      file_name,
      status: "queued" as const,
    }));
    const { error: insErr } = await supabase.from("batch_job_items").insert(items);
    if (insErr) {
      console.error("[batch_job_items] insert", insErr);
      throw insErr;
    }
  }

  return { job: jobRow };
}

export type TryStartResult =
  | { ok: true; started: true }
  | { ok: true; started: false; reason: "already_running" | "already_completed" | "already_failed" };

/**
 * queued → running 전환 (한 번만 성공). 실패 시 이유 반환.
 */
export async function tryStartBatchJob(jobId: string): Promise<TryStartResult> {
  const supabase = getServiceSupabase();

  const { data: cur, error: selErr } = await supabase
    .from("batch_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!cur) {
    return { ok: true, started: false, reason: "already_failed" };
  }

  const st = (cur as { status: string }).status;
  if (st === "running") return { ok: true, started: false, reason: "already_running" };
  if (st === "completed") return { ok: true, started: false, reason: "already_completed" };
  if (st === "failed") return { ok: true, started: false, reason: "already_failed" };
  if (st !== "queued") {
    return { ok: true, started: false, reason: "already_failed" };
  }

  const { data: upd, error: updErr } = await supabase
    .from("batch_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (updErr) throw updErr;
  if (!upd) {
    return { ok: true, started: false, reason: "already_running" };
  }

  return { ok: true, started: true };
}

export async function getBatchJob(jobId: string): Promise<BatchJobRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("batch_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    console.error("[batch_jobs] get", error);
    throw error;
  }
  return data as BatchJobRow | null;
}

export async function listBatchJobItems(jobId: string): Promise<BatchJobItemRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("batch_job_items")
    .select("*")
    .eq("batch_job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[batch_job_items] list", error);
    throw error;
  }
  return (data ?? []) as BatchJobItemRow[];
}

export async function listQueuedBatchJobItems(
  jobId: string,
): Promise<BatchJobItemRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("batch_job_items")
    .select("*")
    .eq("batch_job_id", jobId)
    .eq("status", "queued")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[batch_job_items] queued", error);
    throw error;
  }
  return (data ?? []) as BatchJobItemRow[];
}

export async function updateBatchJobItem(
  itemId: string,
  patch: Partial<
    Pick<
      BatchJobItemRow,
      | "status"
      | "call_id"
      | "stt_status"
      | "analysis_status"
      | "primary_intent"
      | "room_no"
      | "workflow_type"
      | "error_stage"
      | "error_message"
      | "analysis_persist_level"
    >
  >,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("batch_job_items")
    .update(patch)
    .eq("id", itemId);
  if (error) {
    console.error("[batch_job_items] update", error);
    throw error;
  }
}

export async function incrementBatchJobProgress(
  jobId: string,
  success: boolean,
): Promise<void> {
  const supabase = getServiceSupabase();
  const job = await getBatchJob(jobId);
  if (!job) return;

  const processed = job.processed_count + 1;
  const successCount = job.success_count + (success ? 1 : 0);
  const failedCount = job.failed_count + (success ? 0 : 1);

  const done = processed >= job.total_count;
  const { error } = await supabase
    .from("batch_jobs")
    .update({
      processed_count: processed,
      success_count: successCount,
      failed_count: failedCount,
      ...(done
        ? {
            status: "completed" as const,
            finished_at: new Date().toISOString(),
          }
        : {}),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[batch_jobs] increment", error);
    throw error;
  }
}

export async function linkBatchJobItemToCall(
  itemId: string,
  callId: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("batch_job_items")
    .update({ call_id: callId })
    .eq("id", itemId);
  if (error) {
    console.error("[batch_job_items] linkToCall", error);
    throw error;
  }
}

export async function failBatchJob(jobId: string, message: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("batch_jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message,
    })
    .eq("id", jobId);
  if (error) {
    console.error("[batch_jobs] fail", error);
    throw error;
  }
}

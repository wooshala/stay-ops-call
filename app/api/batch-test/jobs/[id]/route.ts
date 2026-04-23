import { listExcludedFileNames } from "@/lib/db/reviewFileState";
import { getBatchStatsFromDB } from "@/lib/db/batchCallStats";
import { getBatchJob } from "@/lib/db/batchJobs";
import { aggregateBatchResults } from "@/lib/batch-test/aggregate";
import type { BatchJobItemRow } from "@/lib/types/database";
import type { BatchTestRow, BatchPipelineMode } from "@/lib/batch-test/types";
import type { CallRow } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deriveErrorStage(code: string | null): "upload" | "stt" | "analysis" | "workflow" | null {
  if (!code) return null;
  if (code === "stt_failed") return "stt";
  if (code === "workflow_failed") return "workflow";
  if (code === "invalid_path" || code === "missing_source_file_name") return "upload";
  return "analysis";
}

function deriveItemStatus(status: string | null): BatchJobItemRow["status"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "processing") return "running";
  return "queued";
}

function callRowToItem(row: CallRow, batchJobId: string): BatchJobItemRow {
  return {
    id: row.id,
    batch_job_id: batchJobId,
    file_name: row.source_file_name ?? row.id,
    status: deriveItemStatus(row.analysis_status),
    call_id: row.id,
    stt_status: row.stt_status ?? null,
    analysis_status: row.analysis_status ?? null,
    analysis_persist_level: row.analysis_persist_level ?? null,
    primary_intent: row.primary_intent ?? null,
    room_no: null,
    workflow_type: null,
    error_stage: deriveErrorStage(row.analysis_error_code ?? null),
    error_message: row.analysis_error_message ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

function callRowToBatchTestRow(row: CallRow, pipeline: BatchPipelineMode): BatchTestRow {
  const analysis_ok = row.analysis_status === "completed";
  const stt_ok = row.stt_status === "completed";
  const analysis_skipped = pipeline === "stt";
  const workflow_skipped = pipeline !== "full";
  const error_stage = deriveErrorStage(row.analysis_error_code ?? null);

  return {
    fileName: row.source_file_name ?? row.id,
    call_id: row.id,
    upload_ok: true,
    stt_ok,
    analysis_ok,
    workflow_ok: analysis_ok && !row.analysis_error_code,
    analysis_skipped,
    workflow_skipped,
    pipeline_mode: pipeline,
    primary_intent: row.primary_intent ?? null,
    room_no: null,
    summary: row.summary ?? null,
    workflow_type: "none",
    error_stage: error_stage as BatchTestRow["error_stage"],
    error_message: row.analysis_error_message ?? null,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const job = await getBatchJob(id);
  if (!job) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let outcome = null;
  let items: BatchJobItemRow[] = [];
  let summary = null;

  try {
    const { rows, stats, failureTop } = await getBatchStatsFromDB(id);
    const excluded = await listExcludedFileNames();
    const names = new Set(
      rows.map((r) => r.source_file_name?.trim() ?? "").filter((s) => s !== ""),
    );
    let excludedInJobScope = 0;
    for (const n of names) {
      if (excluded.has(n)) excludedInJobScope++;
    }
    outcome = {
      failed_count: stats.failed,
      success_count: stats.success,
      pending_count: stats.queued,
      label_ready_count: stats.label_ready,
      call_failed_count: stats.failed,
      call_pending_count: stats.queued,
      has_label_ready: stats.label_ready > 0,
      excluded_in_job_scope: excludedInJobScope,
      top_failure_reasons: failureTop,
    };

    const pipeline = (job.pipeline ?? "full") as BatchPipelineMode;
    items = rows.map((r) => callRowToItem(r, id));
    const batchRows = rows.map((r) => callRowToBatchTestRow(r, pipeline));
    summary = aggregateBatchResults(batchRows, pipeline);
  } catch (e) {
    console.warn("[batch-test/jobs] outcome", e);
  }

  return Response.json({
    job,
    outcome,
    items,
    summary,
  });
}

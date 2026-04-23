import path from "path";
import {
  getBatchTestFixturesDir,
  guessContentType,
  safeResolveFixturePath,
} from "@/lib/batch-test/fixturesPath";
import { sanitizeStorageFileName } from "@/lib/api/validation";
import type { BatchPipelineMode } from "@/lib/batch-test/types";
import {
  getCallById,
  markCallCompleted,
  markCallFailed,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowSkipped,
  updateCallRecording,
} from "@/lib/db/calls";
import { maybeCreateReservationDraftFromAnalysis } from "@/lib/db/reservationDrafts";
import { createReviewCandidateIfNeeded } from "@/lib/db/reviewCandidates";
import { failBatchJob, getBatchJob } from "@/lib/db/batchJobs";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";
import { getRecordingsBucket, getServiceSupabase } from "@/lib/supabase/server";
import { createWorkflowFromCall } from "@/lib/workflows/createWorkflowFromCall";

async function listQueuedCallsForBatch(jobId: string) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("id")
    .eq("batch_job_id", jobId)
    .eq("analysis_status", "queued")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string }>;
}

async function refreshBatchJobCounters(jobId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("analysis_status")
    .eq("batch_job_id", jobId);
  if (error) throw error;

  const rows = data ?? [];
  const processed = rows.filter((r) => r.analysis_status !== "queued").length;
  const success = rows.filter((r) => r.analysis_status === "completed").length;
  const failed = rows.filter((r) => r.analysis_status === "failed").length;
  const done = rows.length > 0 && processed >= rows.length;

  const { error: updErr } = await supabase
    .from("batch_jobs")
    .update({
      processed_count: processed,
      success_count: success,
      failed_count: failed,
      ...(done
        ? {
            status: "completed" as const,
            finished_at: new Date().toISOString(),
            error_message: null,
          }
        : {}),
    })
    .eq("id", jobId);
  if (updErr) throw updErr;
}

async function uploadRecordingForCall(callId: string, fileName: string, absPath: string) {
  const supabase = getServiceSupabase();
  const bucket = getRecordingsBucket();
  const safeName = sanitizeStorageFileName(fileName);
  const storagePath = `${callId}/${Date.now()}-${safeName}`;

  const fileBuffer = await import("fs/promises").then((m) => m.readFile(absPath));
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: guessContentType(fileName),
      upsert: false,
    });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  await updateCallRecording(callId, {
    recording_path: storagePath,
    recording_url: pub?.publicUrl ?? null,
  });
}

async function runPipelineForCall(callId: string, fileName: string, absPath: string, pipeline: BatchPipelineMode) {
  const call = await getCallById(callId);
  if (!call) {
    throw new Error("Call not found");
  }
  if (!call.batch_job_id) {
    throw new Error("batch_job_id missing");
  }

  if (!call.recording_path) {
    await uploadRecordingForCall(callId, fileName, absPath);
  }

  const stt = await runSttForCall(callId);
  if (!stt.ok) {
    await markCallFailed(callId, "stt_failed", stt.error);
    return;
  }

  if (pipeline === "stt") {
    await markCallCompleted(callId);
    return;
  }

  const an = await runAnalysisForCall(callId, { requireBatchJobId: true });
  if (!an.ok) {
    await markCallFailed(callId, an.code ?? "analysis_exception", an.error);
    return;
  }

  if (pipeline === "stt_analysis") {
    await markCallCompleted(callId);
    return;
  }

  const wf = await createWorkflowFromCall(callId, an.analysis);
  if (!wf.ok) {
    await markCallCompleted(callId);
    await markWorkflowFailed(callId, "workflow_failed", wf.error);
    await createReviewCandidateIfNeeded({ callId, analysisResult: an.analysis, workflowResult: { createdType: null }, source: "batch" });
    await maybeCreateReservationDraftFromAnalysis({
      callId,
      analysis: an.analysis,
      workflow: wf,
    });
    return;
  }

  if (wf.createdType === null) {
    await markWorkflowSkipped(callId);
  } else {
    await markWorkflowCompleted(callId);
  }
  await markCallCompleted(callId);
  await createReviewCandidateIfNeeded({ callId, analysisResult: an.analysis, workflowResult: { createdType: wf.createdType, skipped: wf.createdType === null }, source: "batch" });
  await maybeCreateReservationDraftFromAnalysis({
    callId,
    analysis: an.analysis,
    workflow: wf,
  });
}

function deriveSourceFileName(call: Awaited<ReturnType<typeof getCallById>>): string | null {
  const direct = call?.source_file_name?.trim();
  if (direct) return direct;
  const note = call?.note?.trim() ?? "";
  const pfx = "file-review: ";
  if (note.startsWith(pfx)) {
    const n = note.slice(pfx.length).trim();
    return n || null;
  }
  return null;
}

/**
 * 파일 검수 배치 워커: calls(batch_job_id) 기준으로 queued call만 처리한다.
 */
export async function runBatchJobWorker(jobId: string): Promise<void> {
  const job = await getBatchJob(jobId);
  if (!job) return;

  if (job.total_count === 0) {
    const supabase = getServiceSupabase();
    await supabase
      .from("batch_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return;
  }

  const pipeline = job.pipeline as BatchPipelineMode;
  const rawRoot = job.upload_root?.trim();
  const fixturesDir = rawRoot
    ? path.isAbsolute(rawRoot)
      ? rawRoot
      : path.join(process.cwd(), rawRoot)
    : getBatchTestFixturesDir();

  try {
    const queued = await listQueuedCallsForBatch(jobId);
    for (const q of queued) {
      const call = await getCallById(q.id);
      if (!call) continue;
      const fileName = deriveSourceFileName(call);
      if (!fileName) {
        await markCallFailed(call.id, "missing_source_file_name", "source_file_name missing");
        continue;
      }

      const abs = safeResolveFixturePath(fixturesDir, fileName);
      if (!abs) {
        await markCallFailed(call.id, "invalid_path", "잘못된 파일명 또는 경로");
        continue;
      }

      try {
        await runPipelineForCall(call.id, fileName, abs, pipeline);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "처리 중 오류";
        await markCallFailed(call.id, "analysis_exception", msg);
      }
      await refreshBatchJobCounters(jobId);
    }
    await refreshBatchJobCounters(jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배치 작업 실패";
    await failBatchJob(jobId, msg);
  }
}

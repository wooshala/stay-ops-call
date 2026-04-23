import { randomUUID } from "crypto";
import fs from "fs/promises";

import { sanitizeStorageFileName } from "@/lib/api/validation";
import {
  createCallRecord,
  getCallDetailBundle,
  tryUpdateCallAnalysisFailed,
  updateCallRecording,
} from "@/lib/db/calls";
import { upsertPhoneContactFromNewCall } from "@/lib/db/phoneContacts";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";
import { getRecordingsBucket, getServiceSupabase } from "@/lib/supabase/server";
import { createWorkflowFromCall } from "@/lib/workflows/createWorkflowFromCall";

import { guessContentType } from "@/lib/batch-test/fixturesPath";
import type {
  BatchPipelineMode,
  BatchTestRow,
  BatchWorkflowType,
} from "@/lib/batch-test/types";

export interface ProcessBatchOptions {
  pipeline: BatchPipelineMode;
  /** 배치 워커에서 생성한 통화에 저장 */
  batchJobId?: string;
}

function emptyRow(fileName: string, pipeline: BatchPipelineMode): BatchTestRow {
  return {
    fileName,
    call_id: null,
    upload_ok: false,
    stt_ok: false,
    analysis_ok: false,
    workflow_ok: false,
    analysis_skipped: pipeline === "stt",
    workflow_skipped: pipeline === "stt" || pipeline === "stt_analysis",
    pipeline_mode: pipeline,
    primary_intent: null,
    room_no: null,
    summary: null,
    workflow_type: "none",
    error_stage: null,
    error_message: null,
  };
}

async function safeCallBundle(callId: string) {
  try {
    return await getCallDetailBundle(callId);
  } catch (e) {
    console.warn("[processBatchFixture] getCallDetailBundle", e);
    return null;
  }
}

function mapWorkflowType(
  createdType: "operation_case" | "service_request" | "reservation_lead" | null,
): BatchWorkflowType {
  if (createdType === "operation_case") return "operation_case";
  if (createdType === "service_request") return "service_request";
  if (createdType === "reservation_lead") return "reservation_lead";
  return "none";
}

/**
 * 로컬 픽스처 파일 하나에 대해 업로드 후 pipeline 모드에 따라 STT·분석·워크플로 실행.
 */
export async function processBatchFixture(
  fileName: string,
  absolutePath: string,
  options: ProcessBatchOptions,
): Promise<BatchTestRow> {
  const { pipeline, batchJobId } = options;
  const row = emptyRow(fileName, pipeline);

  const id = randomUUID();
  let buf: Buffer;
  try {
    buf = await fs.readFile(absolutePath);
  } catch (e) {
    row.error_stage = "upload";
    row.error_message = e instanceof Error ? e.message : "파일 읽기 실패";
    return row;
  }

  if (buf.length === 0) {
    row.error_stage = "upload";
    row.error_message = "빈 파일";
    return row;
  }

  const supabase = getServiceSupabase();
  const bucket = getRecordingsBucket();
  const safeName = sanitizeStorageFileName(fileName);
  const storagePath = `${id}/${Date.now()}-${safeName}`;

  try {
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, buf, {
        contentType: guessContentType(fileName),
        upsert: false,
      });
    if (upErr) {
      row.error_stage = "upload";
      row.error_message = `Storage: ${upErr.message}`;
      return row;
    }
  } catch (e) {
    row.error_stage = "upload";
    row.error_message = e instanceof Error ? e.message : "Storage 업로드 실패";
    return row;
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const recording_url = pub?.publicUrl ?? null;

  try {
    await createCallRecord({
      id,
      started_at: null,
      ended_at: null,
      duration_sec: null,
      phone_number: null,
      normalized_phone: null,
      direction: "inbound",
      source_type: "internal",
      room_no_hint: null,
      recording_path: storagePath,
      recording_url,
      note: `batch-test: ${fileName}`,
      batch_job_id: batchJobId ?? null,
      source_file_name: fileName,
    });
  } catch (e) {
    row.error_stage = "upload";
    row.error_message = e instanceof Error ? e.message : "calls 행 생성 실패";
    return row;
  }

  row.call_id = id;
  row.upload_ok = true;

  let finalUrl = recording_url;
  if (!finalUrl) {
    const { data: pub2 } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    finalUrl = pub2?.publicUrl ?? null;
    if (finalUrl) {
      await updateCallRecording(id, {
        recording_path: storagePath,
        recording_url: finalUrl,
      });
    }
  }

  try {
    await upsertPhoneContactFromNewCall({
      phone_number: null,
      normalized_phone: null,
      direction: "inbound",
      source_type: "internal",
    });

    const stt = await runSttForCall(id);
    if (!stt.ok) {
      row.error_stage = "stt";
      row.error_message = stt.error;
      const c = await safeCallBundle(id);
      row.primary_intent = c?.call.primary_intent ?? null;
      row.summary = c?.call.summary ?? null;
      return row;
    }
    row.stt_ok = true;

    if (pipeline === "stt") {
      const c = await safeCallBundle(id);
      row.primary_intent = c?.call.primary_intent ?? null;
      row.summary = c?.call.summary ?? null;
      row.analysis_skipped = true;
      row.workflow_skipped = true;
      return row;
    }

    const an = await runAnalysisForCall(id, { requireBatchJobId: true });
    if (!an.ok) {
      row.error_stage = "analysis";
      row.error_message = an.error;
      const c = await safeCallBundle(id);
      row.primary_intent = c?.call.primary_intent ?? null;
      row.summary = c?.call.summary ?? null;
      return row;
    }
    row.analysis_ok = true;
    row.analysis_skipped = false;

    const bundleAfterAnalysis = await safeCallBundle(id);
    row.primary_intent = bundleAfterAnalysis?.call.primary_intent ?? null;
    row.summary = bundleAfterAnalysis?.call.summary ?? null;
    row.room_no = bundleAfterAnalysis?.entities[0]?.room_no ?? null;

    if (pipeline === "stt_analysis") {
      row.workflow_skipped = true;
      return row;
    }

    const wf = await createWorkflowFromCall(id, an.analysis);
    const bundle = await safeCallBundle(id);

    row.primary_intent = bundle?.call.primary_intent ?? null;
    row.summary = bundle?.call.summary ?? null;
    row.room_no = bundle?.entities[0]?.room_no ?? null;

    if (!wf.ok) {
      row.error_stage = "workflow";
      row.error_message = wf.error;
      row.workflow_type = "none";
      row.workflow_skipped = false;
      return row;
    }

    row.workflow_ok = true;
    row.workflow_skipped = false;
    row.workflow_type = mapWorkflowType(wf.createdType);
    return row;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "처리 중 오류";
    console.error("[processBatchFixture]", e);
    try {
      await tryUpdateCallAnalysisFailed(id, msg, {
        code: "batch_pipeline_exception",
      });
    } catch (inner) {
      console.warn("[processBatchFixture] persist failed", inner);
    }
    row.error_stage = row.error_stage ?? "upload";
    row.error_message = msg;
    return row;
  }
}

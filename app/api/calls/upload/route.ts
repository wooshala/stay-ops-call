import { randomUUID } from "crypto";

import { createCallRecord, getCallById, markWorkflowCompleted, markWorkflowFailed, markWorkflowSkipped, updateCallRecording } from "@/lib/db/calls";
import { maybeCreateReservationDraftFromAnalysis } from "@/lib/db/reservationDrafts";
import { createReviewCandidateIfNeeded } from "@/lib/db/reviewCandidates";
import { upsertPhoneContactFromNewCall } from "@/lib/db/phoneContacts";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";
import { createWorkflowFromCall } from "@/lib/workflows/createWorkflowFromCall";
import {
  parseDirectionWithDefault,
  parseSourceType,
  sanitizeStorageFileName,
} from "@/lib/api/validation";
import { getRecordingsBucket, getServiceSupabase } from "@/lib/supabase/server";
import { parseOptionalInt, parseOptionalIso } from "@/lib/utils/datetime";
import { normalizePhone } from "@/lib/utils/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorStage = "stt" | "analysis" | "workflow";

export async function POST(request: Request) {
  const t0 = Date.now();
  const tag = () => `[upload +${Date.now() - t0}ms]`;
  try {
    console.log(tag(), "START");
    const form = await request.formData();
    const file = form.get("file");
    console.log(tag(), "form parsed, file present:", file instanceof File, "size:", file instanceof File ? file.size : 0);

    const started_at = parseOptionalIso(String(form.get("started_at") ?? ""));
    const ended_at = parseOptionalIso(String(form.get("ended_at") ?? ""));
    const duration_sec = parseOptionalInt(String(form.get("duration_sec") ?? ""));
    const phone_number = optionalString(form.get("phone_number"));
    const room_no_hint = optionalString(form.get("room_no_hint"));
    const note = optionalString(form.get("note"));
    const file_fingerprint = optionalString(form.get("file_fingerprint"));
    const device_id = optionalString(form.get("device_id"));
    const mockIdxRaw = optionalString(form.get("mock_stt_sample_index"));
    const mockSampleIndex =
      mockIdxRaw != null && mockIdxRaw !== ""
        ? Number.parseInt(mockIdxRaw, 10)
        : undefined;
    const mockSampleIndexOpt =
      mockSampleIndex !== undefined && Number.isFinite(mockSampleIndex)
        ? mockSampleIndex
        : undefined;

    // source_type 검증 (필수)
    const source_type = parseSourceType(optionalString(form.get("source_type")));
    if (!source_type) {
      return Response.json(
        { ok: false, error: "invalid_source_type" },
        { status: 400 },
      );
    }

    // direction: 없으면 "inbound" 기본값
    const direction = parseDirectionWithDefault(optionalString(form.get("direction")));
    if (!direction) {
      return Response.json(
        { ok: false, error: "invalid_direction" },
        { status: 400 },
      );
    }

    // android_agent 추가 필수 필드 검증
    if (source_type === "android_agent") {
      if (!file_fingerprint) {
        return Response.json(
          { ok: false, error: "file_fingerprint_required" },
          { status: 400 },
        );
      }
      if (!device_id) {
        return Response.json(
          { ok: false, error: "device_id_required" },
          { status: 400 },
        );
      }
    }

    // file_fingerprint 중복 체크 (fingerprint가 있는 모든 업로드에 적용)
    if (file_fingerprint) {
      const supabase = getServiceSupabase();
      const { data: existing, error: dupErr } = await supabase
        .from("calls")
        .select("id")
        .eq("file_fingerprint", file_fingerprint)
        .maybeSingle();

      if (dupErr) {
        console.error("[api/upload] duplicate check error", dupErr);
        return Response.json(
          { ok: false, error: "duplicate_check_failed" },
          { status: 500 },
        );
      }

      if (existing) {
        // call_upload_jobs에 duplicate 기록
        await recordUploadJob({
          device_id: device_id ?? "unknown",
          source_type,
          local_file_name: optionalString(form.get("original_file_name")),
          file_fingerprint,
          status: "duplicate",
          call_id: existing.id,
        });

        return Response.json(
          { ok: false, duplicate: true, call_id: existing.id },
          { status: 409 },
        );
      }
    }

    if (!direction || !source_type) {
      return Response.json(
        { ok: false, error: "source_type and direction are required" },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const normalized_phone = normalizePhone(phone_number);

    let recording_path: string | null = null;
    let recording_url: string | null = null;

    if (file instanceof File && file.size > 0) {
      console.log(tag(), "storage upload start, size:", file.size);
      const supabase = getServiceSupabase();
      const bucket = getRecordingsBucket();
      const safeName = sanitizeStorageFileName(file.name ?? "");
      const path = `${id}/${Date.now()}-${safeName}`;
      const buf = Buffer.from(await file.arrayBuffer());

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, buf, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upErr) {
        console.error(tag(), "storage upload error", upErr.message);
        await recordUploadJob({
          device_id: device_id ?? "unknown",
          source_type,
          local_file_name: optionalString(form.get("original_file_name")),
          file_fingerprint,
          status: "failed",
          failure_reason: upErr.message,
        });
        return Response.json(
          { ok: false, error: `Storage upload failed: ${upErr.message}` },
          { status: 500 },
        );
      }

      recording_path = path;
      const { data: pub } = getServiceSupabase().storage.from(bucket).getPublicUrl(path);
      recording_url = pub?.publicUrl ?? null;
      console.log(tag(), "storage upload done, path:", path);
    }

    console.log(tag(), "DB insert start, source_type:", source_type);
    const row = await createCallRecord({
      id,
      started_at,
      ended_at,
      duration_sec,
      phone_number,
      normalized_phone,
      direction,
      source_type,
      room_no_hint,
      recording_path,
      recording_url,
      note,
      file_fingerprint,
    });

    console.log(tag(), "DB insert done, call_id:", id);

    if (recording_path && !recording_url) {
      const supabase = getServiceSupabase();
      const bucket = getRecordingsBucket();
      const { data: pub } = supabase.storage
        .from(bucket)
        .getPublicUrl(recording_path);
      recording_url = pub?.publicUrl ?? null;
      if (recording_url) {
        await updateCallRecording(id, { recording_path, recording_url });
      }
    }

    await upsertPhoneContactFromNewCall({
      phone_number,
      normalized_phone,
      direction,
      source_type,
    });

    // call_upload_jobs에 성공 기록 (android_agent에서만)
    if (source_type === "android_agent") {
      await recordUploadJob({
        device_id: device_id ?? "unknown",
        source_type,
        local_file_name: optionalString(form.get("original_file_name")),
        file_fingerprint,
        status: "uploaded",
        call_id: id,
      });

      // android_agent: 응답을 STT/analysis 완료까지 블로킹하지 않음.
      // 파이프라인은 별도 트리거(webhook/cron)로 처리.
      console.log(tag(), "android_agent upload complete, returning 200 immediately");
      return Response.json({ ok: true, duplicate: false, call_id: id });
    }

    let error_stage: ErrorStage | undefined;
    let workflow_error: string | undefined;

    console.log(tag(), "STT start");
    const stt = await runSttForCall(id, {
      mockSampleIndex: mockSampleIndexOpt,
    });
    if (!stt.ok) {
      error_stage = "stt";
      const call = await getCallById(id);
      return Response.json({
        ok: true, duplicate: false, call_id: id,
        call,
        stt: null,
        analysis: null,
        workflow: null,
        error_stage,
      });
    }

    const sttPayload = {
      transcript: stt.transcript,
      confidence: stt.confidence,
      provider: stt.provider,
    };

    const an = await runAnalysisForCall(id);
    if (!an.ok) {
      error_stage = "analysis";
      const call = await getCallById(id);
      return Response.json({
        ok: true, duplicate: false, call_id: id,
        call,
        stt: sttPayload,
        analysis: null,
        workflow: null,
        error_stage,
      });
    }

    const wf = await createWorkflowFromCall(id, an.analysis);

    if (!wf.ok) {
      await markWorkflowFailed(id, "workflow_failed", wf.error ?? "");
      error_stage = "workflow";
      workflow_error = wf.error;
    } else if (wf.createdType === null) {
      await markWorkflowSkipped(id);
    } else {
      await markWorkflowCompleted(id);
    }

    await createReviewCandidateIfNeeded({
      callId: id,
      analysisResult: an.analysis,
      workflowResult: { createdType: wf.ok ? wf.createdType : null, skipped: wf.ok && wf.createdType === null },
      source: "upload",
    });

    await maybeCreateReservationDraftFromAnalysis({
      callId: id,
      analysis: an.analysis,
      workflow: wf,
    });

    const call = await getCallById(id);

    if (!wf.ok) {
      return Response.json({
        ok: true, duplicate: false, call_id: id,
        call,
        stt: sttPayload,
        analysis: an.analysis,
        workflow: null,
        error_stage,
        workflow_error,
      });
    }

    return Response.json({
      ok: true, duplicate: false, call_id: id,
      call,
      stt: sttPayload,
      analysis: an.analysis,
      workflow: {
        createdType: wf.createdType,
        createdId: wf.createdId,
      },
    });
  } catch (e) {
    console.error(tag(), "unexpected error", e);
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}

function optionalString(v: FormDataEntryValue | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function recordUploadJob(input: {
  device_id: string;
  source_type: string;
  local_file_name: string | null;
  file_fingerprint: string | null;
  status: string;
  call_id?: string | null;
  failure_reason?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    await supabase.from("call_upload_jobs").insert({
      device_id: input.device_id,
      source_type: input.source_type,
      local_file_name: input.local_file_name,
      file_fingerprint: input.file_fingerprint,
      status: input.status,
      call_id: input.call_id ?? null,
      failure_reason: input.failure_reason ?? null,
    });
  } catch (e) {
    // 장애 추적 실패는 업로드 자체를 막으면 안 됨
    console.warn("[api/upload] recordUploadJob failed (non-fatal)", e);
  }
}

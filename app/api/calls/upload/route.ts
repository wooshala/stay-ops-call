import { randomUUID } from "crypto";
import { after } from "next/server";

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
import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
import { pushUploadedCallPendingEvent } from "@/lib/integrations/univerOpsPendingEvent";
import { processUploadedCallForStt } from "@/lib/pipeline/processUploadedCallForStt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorStage = "stt" | "analysis" | "workflow";

function logUpload(phase: string, payload: Record<string, unknown>) {
  console.log(`[${phase}]`, payload);
}

export async function POST(request: Request) {
  const uploadStarted = Date.now();
  logUpload("CALL_UPLOAD_HIT", {
    method: request.method,
    contentType: request.headers.get("content-type") ?? null,
    hasAuthorization: Boolean(request.headers.get("authorization")),
  });

  try {
    const bearer = getBearerTokenFromRequest(request);
    const internalToken = process.env.INTERNAL_API_TOKEN?.trim();
    if (internalToken) {
      if (bearer === internalToken) {
        logUpload("CALL_UPLOAD_AUTH_OK", { mode: "bearer_matched" });
      } else {
        logUpload("CALL_UPLOAD_AUTH_OK", {
          mode: "bearer_optional_mismatch",
          hasBearer: Boolean(bearer),
        });
      }
    } else {
      logUpload("CALL_UPLOAD_AUTH_OK", { mode: "no_internal_api_token_configured" });
    }

    const form = await request.formData();
    const file = form.get("file");

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

    const source_type = parseSourceType(optionalString(form.get("source_type")));

    logUpload("CALL_UPLOAD_FORM_PARSED", {
      source_type: source_type ?? null,
      device_id: device_id ? `${device_id.slice(0, 8)}…` : null,
      has_file: file instanceof File,
      file_size: file instanceof File ? file.size : 0,
      file_fingerprint_present: Boolean(file_fingerprint),
    });

    if (file instanceof File && file.size > 0) {
      logUpload("CALL_UPLOAD_FILE_RECEIVED", {
        file_name: file.name ?? null,
        file_size: file.size,
        file_type: file.type || null,
      });
    }

    // source_type 검증 (필수)
    if (!source_type) {
      logUpload("CALL_UPLOAD_RESPONSE_SENT", { status: 400, error: "invalid_source_type" });
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

        logUpload("CALL_UPLOAD_RESPONSE_SENT", {
          status: 409,
          duplicate: true,
          call_id: existing.id,
          elapsed_ms: Date.now() - uploadStarted,
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
        console.error("[api/upload] storage upload error", upErr.message);
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
    }

    logUpload("CALL_UPLOAD_DB_INSERT_START", {
      call_id: id,
      source_type,
      recording_path: recording_path ?? null,
    });

    try {
      await createCallRecord({
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
      logUpload("CALL_UPLOAD_DB_INSERT_OK", { call_id: id, source_type });
    } catch (dbErr) {
      logUpload("CALL_UPLOAD_DB_INSERT_FAIL", {
        call_id: id,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
      throw dbErr;
    }

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

      void pushUploadedCallPendingEvent({
        callId: id,
        recordingPath: recording_path,
        phone: phone_number,
        room: room_no_hint,
        fileFingerprint: file_fingerprint,
        deviceId: device_id,
        startedAt: started_at,
      });

      after(async () => {
        logUpload("CALL_UPLOAD_AFTER_START", { call_id: id });
        try {
          await processUploadedCallForStt({
            callId: id,
            phone: phone_number,
            room: room_no_hint,
          });
        } catch (e) {
          logUpload("CALL_UPLOAD_AFTER_FAIL", {
            call_id: id,
            error: e instanceof Error ? e.message : String(e),
          });
          console.error("[android_upload][stt_pipeline]", {
            callId: id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      logUpload("CALL_UPLOAD_RESPONSE_SENT", {
        status: 200,
        call_id: id,
        source_type,
        elapsed_ms: Date.now() - uploadStarted,
      });
      return Response.json({ ok: true, duplicate: false, call_id: id });
    }

    let error_stage: ErrorStage | undefined;
    let workflow_error: string | undefined;

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
    const message = e instanceof Error ? e.message : "Upload failed";
    logUpload("CALL_UPLOAD_RESPONSE_SENT", {
      status: 500,
      error: message,
      elapsed_ms: Date.now() - uploadStarted,
    });
    console.error("[api/upload] unexpected error", e);
    return Response.json(
      { ok: false, error: message },
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

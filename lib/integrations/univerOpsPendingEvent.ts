/**
 * univer-ops pending_events (OpsInbox) push.
 * 업로드 성공 후 통화 이벤트 1건 생성 — 실패해도 업로드 API는 성공 유지.
 */

const UNIVER_OPS_URL = process.env.UNIVER_OPS_URL?.trim() ?? "";
const INTERNAL_EVENTS_SECRET =
  process.env.INTERNAL_EVENTS_SECRET?.trim() ??
  process.env.UNIVER_OPS_SECRET?.trim() ??
  "";

import { buildPendingEventPhoneFields } from "@/lib/integrations/resolveCallPhoneForPending";

const UPLOAD_PENDING_SUMMARY =
  "통화 녹음이 업로드되었습니다. STT 분석 대기 중입니다.";

export type PushUploadedCallPendingEventInput = {
  callId: string;
  recordingPath: string | null;
  phone?: string | null;
  normalizedPhone?: string | null;
  room?: string | null;
  fileFingerprint?: string | null;
  deviceId?: string | null;
  startedAt?: string | null;
};

function pendingEventsConfigured(): boolean {
  return Boolean(UNIVER_OPS_URL && INTERNAL_EVENTS_SECRET);
}

/** android_agent 업로드 직후 OpsInbox용 pending_events 1건 push */
export async function pushUploadedCallPendingEvent(
  input: PushUploadedCallPendingEventInput,
): Promise<void> {
  if (!pendingEventsConfigured()) {
    console.warn("[UNIVER_PENDING_EVENT_PUSH_FAIL]", {
      callId: input.callId,
      reason: "UNIVER_OPS_URL or INTERNAL_EVENTS_SECRET not configured",
    });
    return;
  }

  const sourceEventId = `call-upload:${input.callId}`;

  console.log("[UNIVER_PENDING_EVENT_PUSH_START]", {
    callId: input.callId,
    source_event_id: sourceEventId,
  });

  const phoneFields = buildPendingEventPhoneFields({
    phone_number: input.phone,
    normalized_phone: input.normalizedPhone,
  });

  const payload = {
    event_version: 1,
    event_type: "service_request" as const,
    source_type: "call" as const,
    source_event_id: sourceEventId,
    summary: UPLOAD_PENDING_SUMMARY,
    phone: phoneFields.phone,
    room: input.room?.trim() || null,
    priority: "normal" as const,
    occurred_at: input.startedAt ?? null,
    context: {
      source: "stay-ops-call",
      call_id: input.callId,
      recording_path: input.recordingPath,
      file_fingerprint: input.fileFingerprint ?? null,
      device_id: input.deviceId ?? null,
      stage: "uploaded_without_stt",
      customer_phone: phoneFields.customer_phone,
      normalized_phone: phoneFields.normalized_phone,
      phone_number: phoneFields.phone_number,
    },
  };

  try {
    const res = await fetch(`${UNIVER_OPS_URL}/api/pending-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${INTERNAL_EVENTS_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    const text = await res.text();
    type PendingEventPushResponse = {
      ok?: boolean;
      skipped?: boolean;
      error?: string;
    };
    let json: PendingEventPushResponse | null = null;
    try {
      json = text ? (JSON.parse(text) as PendingEventPushResponse) : null;
    } catch {
      json = null;
    }

    if (res.ok && json?.ok !== false) {
      console.log("[UNIVER_PENDING_EVENT_PUSH_OK]", {
        callId: input.callId,
        source_event_id: sourceEventId,
        skipped: json?.skipped ?? false,
        status: res.status,
      });
      return;
    }

    console.warn("[UNIVER_PENDING_EVENT_PUSH_FAIL]", {
      callId: input.callId,
      source_event_id: sourceEventId,
      status: res.status,
      error: json?.error ?? (text.slice(0, 200) || res.statusText),
    });
  } catch (e) {
    console.warn("[UNIVER_PENDING_EVENT_PUSH_FAIL]", {
      callId: input.callId,
      source_event_id: sourceEventId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

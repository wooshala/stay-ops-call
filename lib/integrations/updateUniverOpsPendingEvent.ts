import type { AnalysisResult } from "@/lib/analysis/schema";
import type { TranscriptUncertaintyAssessment } from "@/lib/analysis/transcriptUncertainty";
import { sanitizeOpenAIErrorMessage } from "@/lib/openai/client";
import {
  buildStructuredPendingSummary,
  primaryIntentToPendingEventType,
} from "@/lib/integrations/buildStructuredPendingSummary";

const UNIVER_OPS_URL = process.env.UNIVER_OPS_URL?.trim() ?? "";
const INTERNAL_EVENTS_SECRET =
  process.env.INTERNAL_EVENTS_SECRET?.trim() ??
  process.env.UNIVER_OPS_SECRET?.trim() ??
  "";

export type UpdatePendingEventAfterSttInput = {
  callId: string;
  analysis: AnalysisResult;
  transcript: string;
  phone?: string | null;
  room?: string | null;
  sttMs?: number;
  analysisMs?: number;
  uncertain?: TranscriptUncertaintyAssessment | null;
};

function pendingEventsConfigured(): boolean {
  return Boolean(UNIVER_OPS_URL && INTERNAL_EVENTS_SECRET);
}

function sourceEventId(callId: string): string {
  return `call-upload:${callId}`;
}

async function patchOnce(
  sourceEventIdValue: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetch(`${UNIVER_OPS_URL}/api/pending-events/by-source`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${INTERNAL_EVENTS_SECRET}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  const text = await res.text();
  type PatchResponse = { ok?: boolean; error?: string };
  let json: PatchResponse | null = null;
  try {
    json = text ? (JSON.parse(text) as PatchResponse) : null;
  } catch {
    json = null;
  }

  if (res.ok && json?.ok !== false) {
    return { ok: true, status: res.status };
  }

  return {
    ok: false,
    status: res.status,
    error: json?.error ?? (text.slice(0, 200) || res.statusText),
  };
}

/** STT·분석 완료 후 기존 pending_event summary/event_type 갱신 */
export async function updatePendingEventAfterStt(
  input: UpdatePendingEventAfterSttInput,
): Promise<boolean> {
  if (!pendingEventsConfigured()) {
    console.warn("[PENDING_EVENT_UPDATE_FAIL]", {
      callId: input.callId,
      reason: "UNIVER_OPS_URL or INTERNAL_EVENTS_SECRET not configured",
    });
    return false;
  }

  const eventId = sourceEventId(input.callId);
  const uncertain = input.uncertain ?? null;
  const summary = buildStructuredPendingSummary(input.analysis, input.phone, {
    uncertain,
  });
  const eventType = uncertain?.isUncertain
    ? uncertain.eventType
    : primaryIntentToPendingEventType(input.analysis.primary_intent);
  const room =
    input.room?.trim() ||
    input.analysis.entities.room_no?.trim() ||
    null;

  const payload = {
    source_event_id: eventId,
    source_type: "call" as const,
    summary,
    event_type: eventType,
    room,
    phone: input.phone?.trim() || null,
    context: {
      source: "stay-ops-call",
      stage: uncertain?.stage ?? "stt_completed",
      call_id: input.callId,
      primary_intent: input.analysis.primary_intent,
      transcript_preview: input.transcript.slice(0, 200),
      stt_ms: input.sttMs ?? null,
      analysis_ms: input.analysisMs ?? null,
      confidence: input.analysis.confidence,
      ...(uncertain?.isUncertain
        ? {
            warning: uncertain.primaryWarning,
            warnings: uncertain.warnings,
            analysis_skipped: uncertain.skipLlm,
          }
        : {}),
    },
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await patchOnce(eventId, payload);
    if (result.ok) {
      console.log("[PENDING_EVENT_UPDATED]", {
        callId: input.callId,
        source_event_id: eventId,
        event_type: eventType,
        summary,
        attempt,
      });
      return true;
    }

    if (result.status !== 404 || attempt === 5) {
      console.warn("[PENDING_EVENT_UPDATE_FAIL]", {
        callId: input.callId,
        source_event_id: eventId,
        status: result.status,
        error: result.error,
        attempt,
      });
      return false;
    }

    await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  return false;
}

const STT_FAILED_SUMMARY =
  "통화 녹음 STT 분석에 실패했습니다. 설정 확인이 필요합니다.";

/** STT 실패 시 pending_events를 stt_failed로 갱신 (OpsInbox에 대기 중이 아닌 실패 표시) */
export async function updatePendingEventOnSttFailed(
  callId: string,
  sttError: string,
): Promise<boolean> {
  console.log("[CALL_PENDING_EVENT_STT_FAILED_PATCH_START]", { callId });

  if (!pendingEventsConfigured()) {
    console.warn("[CALL_PENDING_EVENT_STT_FAILED_PATCH_FAIL]", {
      callId,
      reason: "UNIVER_OPS_URL or INTERNAL_EVENTS_SECRET not configured",
    });
    return false;
  }

  const eventId = sourceEventId(callId);
  const safeError = sanitizeOpenAIErrorMessage(sttError);

  const payload = {
    source_event_id: eventId,
    source_type: "call" as const,
    summary: STT_FAILED_SUMMARY,
    event_type: "service_request" as const,
    context: {
      source: "stay-ops-call",
      stage: "stt_failed",
      call_id: callId,
      stt_error: safeError,
      failed_at: new Date().toISOString(),
    },
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await patchOnce(eventId, payload);
    if (result.ok) {
      console.log("[CALL_PENDING_EVENT_STT_FAILED_PATCH_OK]", {
        callId,
        source_event_id: eventId,
        attempt,
      });
      return true;
    }

    if (result.status !== 404 || attempt === 5) {
      console.warn("[CALL_PENDING_EVENT_STT_FAILED_PATCH_FAIL]", {
        callId,
        source_event_id: eventId,
        status: result.status,
        error: result.error,
        attempt,
      });
      return false;
    }

    await new Promise((r) => setTimeout(r, 400 * attempt));
  }

  return false;
}

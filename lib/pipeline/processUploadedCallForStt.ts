import type { AnalysisResult } from "@/lib/analysis/schema";
import {
  assessTranscriptUncertainty,
  buildUncertainAnalysisResult,
  type TranscriptUncertaintyAssessment,
} from "@/lib/analysis/transcriptUncertainty";
import {
  tryUpdateCallAnalysisSkipped,
  type CallAnalysisSkippedPatch,
} from "@/lib/db/calls";
import {
  updatePendingEventAfterStt,
  updatePendingEventOnSttFailed,
} from "@/lib/integrations/updateUniverOpsPendingEvent";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";

/** uncertain 종결 시 calls.analysis_error_code 에 기록하는 사유 코드 */
export const UNCERTAIN_ERROR_CODE = "transcript_uncertain";
/** uncertain 경로는 LLM 스키마를 타지 않으므로 별도 버전 태그를 쓴다 */
const UNCERTAIN_ANALYSIS_VERSION = "uncertain-1";

/**
 * uncertain 종결 시 calls 에 기록할 patch 를 만든다 (순수 함수 — 테스트 대상).
 *
 * 계약:
 *  - `analysis_error_code` 는 항상 `transcript_uncertain`
 *  - `analysis_error_message` 는 **사유 코드만** 담는다(transcript 원문·전화번호 금지)
 *  - `summary` 는 사용자에게 보여줄 짧은 보류 안내
 */
export function buildUncertainSkipPatch(
  uncertain: TranscriptUncertaintyAssessment,
  analysis: AnalysisResult,
): CallAnalysisSkippedPatch {
  return {
    summary: analysis.summary,
    primary_intent: analysis.primary_intent,
    secondary_tags: analysis.secondary_tags,
    analysis_confidence: analysis.confidence,
    analysis_version: UNCERTAIN_ANALYSIS_VERSION,
    transcript_cleaned: null,
    analysis_input_text: null,
    analysis_error_code: UNCERTAIN_ERROR_CODE,
    analysis_error_message: `LLM 분석 보류: ${uncertain.warnings.join(",")}`,
  };
}

export type ProcessUploadedCallForSttInput = {
  callId: string;
  phone?: string | null;
  normalizedPhone?: string | null;
  room?: string | null;
};

export type ProcessUploadedCallForSttResult = {
  ok: boolean;
  stage: "stt_failed" | "analysis_failed" | "stt_completed";
  callId: string;
  error?: string;
  pendingEventPatched?: boolean;
};

/**
 * android_agent 업로드 후 백그라운드 STT → LLM 구조화 → pending_event summary 갱신.
 * 업로드 API 응답과 분리되어 실행한다.
 */
export async function processUploadedCallForStt(
  input: ProcessUploadedCallForSttInput,
): Promise<ProcessUploadedCallForSttResult> {
  const { callId, phone, normalizedPhone, room } = input;
  const pipelineStarted = Date.now();

  console.log("[CALL_STT_START]", { callId });

  const sttStarted = Date.now();
  const stt = await runSttForCall(callId);
  const sttMs = Date.now() - sttStarted;

  if (!stt.ok) {
    console.warn("[CALL_STT_FAILED]", {
      callId,
      error: stt.error,
      sttMs,
    });
    console.warn("[CALL_STT_DONE]", {
      callId,
      ok: false,
      error: stt.error,
      sttMs,
    });
    const pendingEventPatched = await updatePendingEventOnSttFailed(
      callId,
      stt.error,
    );
    return {
      ok: false,
      stage: "stt_failed",
      callId,
      error: stt.error,
      pendingEventPatched,
    };
  }

  console.log("[CALL_STT_DONE]", {
    callId,
    ok: true,
    provider: stt.provider,
    transcriptLength: stt.transcript.length,
    sttMs,
  });

  const uncertain = assessTranscriptUncertainty({
    transcript: stt.transcript,
    durationSec: stt.call.duration_sec,
  });

  let analysisMs = 0;
  let analysis: AnalysisResult;

  if (uncertain) {
    analysis = buildUncertainAnalysisResult(uncertain, stt.transcript);

    // LLM 은 생략하되 calls 원장에는 반드시 **종결 상태**를 남긴다.
    // 이 write 가 없으면 analysis_status 가 queued 로 영구 잔류한다 —
    // 재수거 워커도 재시도도 없기 때문(CALL-ANALYSIS-QUEUE-001).
    const persistLevel = await tryUpdateCallAnalysisSkipped(
      callId,
      buildUncertainSkipPatch(uncertain, analysis),
    );

    if (persistLevel === "none") {
      // 조용히 성공 처리하지 않는다. queued 로 남았을 수 있음을 명시한다.
      console.error("[CALL_ANALYSIS_TERMINAL_PERSIST_FAILED]", {
        callId,
        stage: "uncertain",
        warnings: uncertain.warnings,
        reason: "calls update failed on all layers; analysis_status may stay queued",
      });
    }

    console.log("[CALL_STRUCTURED]", {
      callId,
      uncertain: true,
      warnings: uncertain.warnings,
      primary_intent: analysis.primary_intent,
      confidence: analysis.confidence,
      persistLevel,
      analysisMs: 0,
      pipelineMs: Date.now() - pipelineStarted,
    });
  } else {
    const analysisStarted = Date.now();
    const analysisResult = await runAnalysisForCall(callId);
    analysisMs = Date.now() - analysisStarted;

    if (!analysisResult.ok) {
      console.warn("[CALL_STRUCTURED]", {
        callId,
        ok: false,
        error: analysisResult.error,
        code: analysisResult.code,
        analysisMs,
      });
      return {
        ok: false,
        stage: "analysis_failed",
        callId,
        error: analysisResult.error,
      };
    }

    analysis = analysisResult.analysis;

    console.log("[CALL_STRUCTURED]", {
      callId,
      primary_intent: analysis.primary_intent,
      summary: analysis.summary,
      confidence: analysis.confidence,
      analysisMs,
      pipelineMs: Date.now() - pipelineStarted,
    });
  }

  const pendingEventPatched = await updatePendingEventAfterStt({
    callId,
    analysis,
    transcript: stt.transcript,
    phone: stt.call.phone_number ?? phone,
    normalizedPhone: stt.call.normalized_phone ?? normalizedPhone,
    room,
    sttMs,
    analysisMs,
    uncertain,
  });

  return {
    ok: true,
    stage: "stt_completed",
    callId,
    pendingEventPatched,
  };
}

import type { AnalysisResult } from "@/lib/analysis/schema";
import {
  assessTranscriptUncertainty,
  buildUncertainAnalysisResult,
} from "@/lib/analysis/transcriptUncertainty";
import { updatePendingEventAfterStt } from "@/lib/integrations/updateUniverOpsPendingEvent";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";

export type ProcessUploadedCallForSttInput = {
  callId: string;
  phone?: string | null;
  room?: string | null;
};

/**
 * android_agent 업로드 후 백그라운드 STT → LLM 구조화 → pending_event summary 갱신.
 * 업로드 API 응답과 분리되어 실행한다.
 */
export async function processUploadedCallForStt(
  input: ProcessUploadedCallForSttInput,
): Promise<void> {
  const { callId, phone, room } = input;
  const pipelineStarted = Date.now();

  console.log("[CALL_STT_START]", { callId });

  const sttStarted = Date.now();
  const stt = await runSttForCall(callId);
  const sttMs = Date.now() - sttStarted;

  if (!stt.ok) {
    console.warn("[CALL_STT_DONE]", {
      callId,
      ok: false,
      error: stt.error,
      sttMs,
    });
    return;
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
    console.log("[CALL_STRUCTURED]", {
      callId,
      uncertain: true,
      warnings: uncertain.warnings,
      primary_intent: analysis.primary_intent,
      summary: analysis.summary,
      confidence: analysis.confidence,
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
      return;
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

  await updatePendingEventAfterStt({
    callId,
    analysis,
    transcript: stt.transcript,
    phone,
    room,
    sttMs,
    analysisMs,
    uncertain,
  });
}

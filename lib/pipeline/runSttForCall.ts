import {
  getCallById,
  tryUpdateCallAnalysisFailed,
  updateCallSttFailed,
  updateCallSttProcessing,
  updateCallSttSuccess,
} from "@/lib/db/calls";
import type { CallRow } from "@/lib/types/database";
import { getSttProvider } from "@/lib/stt";
import { getRecordingsBucket } from "@/lib/supabase/server";

export type RunSttResult =
  | {
      ok: true;
      transcript: string;
      confidence: number | null;
      provider: string;
      call: CallRow;
    }
  | { ok: false; error: string; call: CallRow | null };

/**
 * STT 실행. 업로드 직후 파이프라인·수동 API에서 공통 사용.
 * (나중에 worker로 옮길 때 이 함수를 그대로 호출하면 됨)
 */
export async function runSttForCall(
  callId: string,
  options?: { mockSampleIndex?: number },
): Promise<RunSttResult> {
  let call = await getCallById(callId);
  if (!call) {
    return { ok: false, error: "Call not found", call: null };
  }

  try {
    await updateCallSttProcessing(callId);

    const provider = getSttProvider();
    const bucket = getRecordingsBucket();
    const storagePath = call.recording_path ?? `mock/${callId}`;

    const result = await provider.transcribeAudio({
      storageBucket: bucket,
      storagePath,
      mockSampleIndex: options?.mockSampleIndex,
    });

    await updateCallSttSuccess(callId, {
      transcript_text: result.transcript,
      stt_confidence: result.confidence,
      stt_provider: result.provider,
    });

    call = await getCallById(callId);
    if (!call) {
      return { ok: false, error: "Call missing after STT", call: null };
    }

    return {
      ok: true,
      transcript: result.transcript,
      confidence: result.confidence,
      provider: result.provider,
      call,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "STT failed";
    console.error("[stt] failed", { callId, error: msg });
    try {
      await updateCallSttFailed(callId, msg);
    } catch (inner) {
      console.error("[stt] persist failure", { callId, error: inner });
    }
    await tryUpdateCallAnalysisFailed(callId, `STT: ${msg}`, {
      code: "stt_failed",
    });
    call = await getCallById(callId);
    return { ok: false, error: msg, call };
  }
}

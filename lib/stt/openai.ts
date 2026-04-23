import OpenAI, { toFile } from "openai";

import { getServiceSupabase } from "@/lib/supabase/server";
import type { SttProvider, SttResult } from "@/lib/stt/provider";

/**
 * Supabase Storage에서 오디오를 내려받아 OpenAI Audio Transcriptions API로 보냄.
 * (향후: 로컬 경로/diarize/timestamps는 이 함수를 분리·확장)
 */
export class OpenAISttProvider implements SttProvider {
  async transcribeAudio(params: {
    storageBucket: string;
    storagePath: string;
    mockSampleIndex?: number;
  }): Promise<SttResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when STT_PROVIDER=openai",
      );
    }

    if (params.storagePath.startsWith("mock/")) {
      throw new Error(
        "No recording file: upload an audio file for OpenAI transcription, or set STT_PROVIDER=mock for tests without a file.",
      );
    }

    const supabase = getServiceSupabase();
    const { data: blob, error: dlErr } = await supabase.storage
      .from(params.storageBucket)
      .download(params.storagePath);

    if (dlErr || !blob) {
      throw new Error(
        dlErr?.message ?? "Failed to download recording from storage",
      );
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const ext =
      params.storagePath.split(".").pop()?.toLowerCase() ?? "m4a";
    const filename = `audio.${ext}`;
    const mime = mimeForExt(ext);

    const file = await toFile(buf, filename, { type: mime });

    const model =
      process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-mini-transcribe";

    const client = new OpenAI({ apiKey });
    const res = await client.audio.transcriptions.create({
      file,
      model,
    });

    const text = typeof res.text === "string" ? res.text.trim() : "";
    if (!text) {
      throw new Error("OpenAI returned empty transcript");
    }

    return {
      transcript: text,
      confidence: null,
      provider: "openai",
    };
  }
}

function mimeForExt(ext: string): string {
  switch (ext) {
    case "m4a":
    case "mp4":
    case "mpeg":
    case "mpga":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

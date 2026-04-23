import { MOCK_STT_SAMPLES, getMockTranscriptByIndex } from "@/lib/stt/samples";
import type { SttProvider, SttResult } from "@/lib/stt/provider";

/**
 * Mock STT: ignores audio bytes; returns a Korean transcript for testing.
 * Uses mockSampleIndex when provided; otherwise cycles by storagePath hash.
 */
export class MockSttProvider implements SttProvider {
  async transcribeAudio(params: {
    storageBucket: string;
    storagePath: string;
    mockSampleIndex?: number;
  }): Promise<SttResult> {
    const idx =
      params.mockSampleIndex !== undefined
        ? params.mockSampleIndex
        : simpleHash(params.storagePath) % MOCK_STT_SAMPLES.length;

    const transcript = getMockTranscriptByIndex(idx);
    const c = 0.88 + (idx % 5) * 0.02;

    return {
      transcript,
      confidence: Math.min(0.99, Math.round(c * 100) / 100),
      provider: "mock",
    };
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

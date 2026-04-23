import { fallbackAnalysisResult } from "@/lib/analysis/fallback";
import { runAnalysisLLM } from "@/lib/analysis/runLLM";
import {
  parseAnalysisJson,
  type AnalysisResult,
} from "@/lib/analysis/schema";

export interface AnalyzeCallOptions {
  transcript: string;
}

/**
 * 분석 실행 (mock / OpenAI). JSON 파싱 실패 시 throw 없이 휴리스틱 fallback.
 */
export async function analyzeCall(
  options: AnalyzeCallOptions,
): Promise<AnalysisResult> {
  const r = await runAnalysisLLM(options.transcript);
  if (r.ok) return r.data;
  return fallbackAnalysisResult(options.transcript);
}

export function tryParseAnalysisJson(raw: unknown): AnalysisResult {
  return parseAnalysisJson(raw);
}

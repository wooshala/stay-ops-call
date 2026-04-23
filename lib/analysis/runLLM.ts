import OpenAI from "openai";

import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/analysis/prompt";
import { getMockAnalysisForTranscript } from "@/lib/analysis/sampleData";
import {
  type AnalysisResult,
  safeParseAnalysisJson,
} from "@/lib/analysis/schema";

function extractJsonBlock(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fence) return fence[1]!.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseAssistantToAnalysis(
  content: string,
): { ok: true; data: AnalysisResult } | { ok: false } {
  const block = extractJsonBlock(content);
  let raw: unknown;
  try {
    raw = JSON.parse(block);
  } catch {
    return { ok: false };
  }
  const parsed = safeParseAnalysisJson(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false };
}

export type RunAnalysisLLMResult =
  | { ok: true; data: AnalysisResult; raw: string }
  | { ok: false; raw: string; reason: "api_error" | "json_parse" };

/**
 * 프롬프트 + 모델 호출. 파싱 실패 시 throw 없이 ok: false.
 */
export async function runAnalysisLLM(text: string): Promise<RunAnalysisLLMResult> {
  const provider = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  const debug = process.env.DEBUG_LLM_RESPONSE === "1";
  if (debug) {
    const payload = {
      callId: null,
      promptLength: typeof text === "string" ? text.length : 0,
    };
    console.log("=== LLM DEBUG REQUEST ===", payload);
    console.error("=== LLM DEBUG REQUEST ===", payload);
  }

  if (provider === "mock") {
    const data = getMockAnalysisForTranscript(text);
    const raw = JSON.stringify(data);
    if (debug) {
      const preview = raw.length > 600 ? `${raw.slice(0, 600)}…[truncated:${raw.length}]` : raw;
      const payload = {
        callId: null,
        hasText: raw.trim().length > 0,
        textLength: raw.length,
        preview,
      };
      console.log("=== LLM DEBUG RESPONSE ===", payload);
      console.error("=== LLM DEBUG RESPONSE ===", payload);
    }
    return { ok: true, data, raw };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    console.warn(
      "[runAnalysisLLM] OPENAI_API_KEY 없음 — mock 분석으로 대체합니다.",
    );
    const data = getMockAnalysisForTranscript(text);
    const raw = JSON.stringify(data);
    if (debug) {
      const preview = raw.length > 600 ? `${raw.slice(0, 600)}…[truncated:${raw.length}]` : raw;
      const payload = {
        callId: null,
        hasText: raw.trim().length > 0,
        textLength: raw.length,
        preview,
      };
      console.log("=== LLM DEBUG RESPONSE ===", payload);
      console.error("=== LLM DEBUG RESPONSE ===", payload);
    }
    return { ok: true, data, raw };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const model =
      process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4o-mini";

    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `다음은 숙박 시설 프런트 통화 STT입니다. JSON만 출력하세요.\n\n${text}`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = res.choices[0]?.message?.content ?? "";
    const raw = content;
    if (debug) {
      const preview = raw.length > 600 ? `${raw.slice(0, 600)}…[truncated:${raw.length}]` : raw;
      const payload = {
        callId: null,
        hasText: raw.trim().length > 0,
        textLength: raw.length,
        preview,
      };
      console.log("=== LLM DEBUG RESPONSE ===", payload);
      console.error("=== LLM DEBUG RESPONSE ===", payload);
    }
    const parsed = parseAssistantToAnalysis(content);
    if (parsed.ok) {
      return { ok: true, data: parsed.data, raw };
    }
    return { ok: false, raw, reason: "json_parse" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[runAnalysisLLM] API 오류", e);
    return { ok: false, raw: msg, reason: "api_error" };
  }
}

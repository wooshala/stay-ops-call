import type { CallRow } from "@/lib/types/database";

export type ReviewScoreReasons = Record<string, number>;

/**
 * 검수 우선순위 점수 (높을수록 먼저 볼 가치).
 * 가중치: warning +30, partial +20, fallback +20, 기타 +15, intent 낮음 +10, summary 짧음 +10
 */
export function computeReviewPriorityScoreAndReasons(
  call: CallRow,
): { score: number; reasons: ReviewScoreReasons } {
  const reasons: ReviewScoreReasons = {};
  let s = 0;

  if (call.analysis_status === "warning") {
    reasons.warning = 30;
    s += 30;
  }
  if (call.analysis_status === "partial") {
    reasons.partial = 20;
    s += 20;
  }
  let fb = false;
  if (call.analysis_error_code === "llm_parse_fallback") {
    fb = true;
  } else {
    const tags = call.secondary_tags;
    if (Array.isArray(tags) && tags.includes("llm_parse_fallback")) {
      fb = true;
    }
  }
  if (fb) {
    reasons.fallback = 20;
    s += 20;
  }
  if (call.primary_intent === "other") {
    reasons.call_type_other = 15;
    s += 15;
  }
  const conf = call.analysis_confidence;
  if (conf != null && conf < 0.4) {
    reasons.low_intent_confidence = 10;
    s += 10;
  }
  const sumLen = call.summary?.trim().length ?? 0;
  if (sumLen > 0 && sumLen < 10) {
    reasons.short_summary = 10;
    s += 10;
  }

  return { score: s, reasons };
}

/** @deprecated prefer computeReviewPriorityScoreAndReasons */
export function computeReviewPriorityScore(call: CallRow): number {
  return computeReviewPriorityScoreAndReasons(call).score;
}

export function isLikelyFallback(call: CallRow): boolean {
  if (call.analysis_error_code === "llm_parse_fallback") return true;
  const tags = call.secondary_tags;
  if (Array.isArray(tags) && tags.includes("llm_parse_fallback")) return true;
  return false;
}

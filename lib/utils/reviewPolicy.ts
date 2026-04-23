export type ReviewDecision = "normal" | "needs_review" | "low_confidence";

export interface ReviewPolicy {
  decision: ReviewDecision;
  reason: string;
}

/**
 * confidence 점수 기반 검수 정책.
 * >= 0.7  → normal (자동 통과)
 * 0.3~0.7 → needs_review (사람 검수 필요)
 * < 0.3   → low_confidence (신뢰도 낮음, 재분석 권고)
 */
export function getReviewPolicy(confidence: number | null | undefined): ReviewPolicy {
  const c = confidence ?? 0;
  if (c >= 0.7) {
    return { decision: "normal", reason: "confidence >= 0.7" };
  }
  if (c >= 0.3) {
    return { decision: "needs_review", reason: "confidence 0.3~0.7" };
  }
  return { decision: "low_confidence", reason: "confidence < 0.3" };
}

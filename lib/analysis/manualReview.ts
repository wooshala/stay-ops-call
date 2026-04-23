import type { AnalysisResult } from "@/lib/analysis/schema";

/**
 * 분석 제공자 실패·스키마 검증 실패 시 저장용 최소 결과.
 */
export function buildManualReviewAnalysisResult(errorDetail: string): AnalysisResult {
  const short =
    errorDetail.length > 280 ? `${errorDetail.slice(0, 277)}…` : errorDetail;
  return {
    summary: `자동 분석에 실패했습니다. 수동 검토가 필요합니다. (${short})`,
    primary_intent: "manual_review_required",
    secondary_tags: ["analysis_failed"],
    confidence: 0.1,
    entities: {
      room_no: null,
      guest_name: null,
      issue_type: null,
      item_requested: null,
      quantity: null,
      unit: null,
      arrival_eta: null,
      occupancy_count: null,
      checkin_date: null,
      checkout_date: null,
      quoted_price: null,
      complaint_reason: null,
      amount: null,
      payment_method: null,
      payment_deposit: null,
      group_booking: null,
      room_count: null,
      deposit_amount: null,
      parking_count: null,
    },
    recommended_actions: [
      {
        action_type: "manual_review",
        title: "통화 수동 검토",
        description:
          "STT·결제 정보 마스킹 후에도 분석이 완료되지 않았습니다. 녹음·원문으로 확인하세요.",
        priority: "high",
      },
    ],
  };
}

/** 짧은/무의미 STT — LLM 미호출 */
export function buildShortTranscriptAnalysisResult(
  overrideSummary?: string,
): AnalysisResult {
  return {
    summary:
      overrideSummary?.trim() ||
      "통화 내용이 너무 짧거나 인사 수준이라 자동 분석을 생략했습니다.",
    primary_intent: "other",
    secondary_tags: ["short_transcript"],
    actionable_secondary_intents: null,
    confidence: 0.05,
    entities: {
      room_no: null,
      guest_name: null,
      issue_type: null,
      item_requested: null,
      quantity: null,
      unit: null,
      arrival_eta: null,
      occupancy_count: null,
      checkin_date: null,
      checkout_date: null,
      quoted_price: null,
      complaint_reason: null,
      amount: null,
      payment_method: null,
      payment_deposit: null,
      group_booking: null,
      room_count: null,
      deposit_amount: null,
      parking_count: null,
    },
    recommended_actions: [],
  };
}

import type { AnalysisResult } from "@/lib/analysis/schema";
import type { TranscriptUncertaintyAssessment } from "@/lib/analysis/transcriptUncertainty";
import {
  buildReservationStaffContext,
  buildReservationStaffSummaryLines,
  isReservationStaffIntent,
} from "@/lib/analysis/reservationStaffFields";

type PendingEventType =
  | "maintenance"
  | "complaint"
  | "reservation_lead"
  | "service_request";

const INTENT_TYPE_LABEL: Record<string, string> = {
  maintenance: "점검",
  complaint: "컴플레인",
  service_request: "서비스 요청",
  reservation_inquiry: "예약 문의",
  rate_inquiry: "요금 문의",
  extension_request: "연장 문의",
  quotation_intent: "견적 문의",
  checkin_checkout: "체크인·체크아웃",
  payment: "결제",
  cancel_request: "취소 문의",
  refund_request: "환불 문의",
  parking: "주차 문의",
  other: "기타 문의",
  manual_review_required: "수동 검토",
  test_or_unclear: "테스트·내용 불명",
};

const CALLBACK_INTENTS = new Set([
  "reservation_inquiry",
  "rate_inquiry",
  "extension_request",
  "quotation_intent",
  "complaint",
]);

export function primaryIntentToPendingEventType(
  intent: AnalysisResult["primary_intent"],
): PendingEventType {
  switch (intent) {
    case "maintenance":
      return "maintenance";
    case "complaint":
      return "complaint";
    case "reservation_inquiry":
    case "rate_inquiry":
    case "extension_request":
    case "quotation_intent":
    case "checkin_checkout":
      return "reservation_lead";
    case "test_or_unclear":
    case "manual_review_required":
      return "service_request";
    default:
      return "service_request";
  }
}

function suggestsCallback(analysis: AnalysisResult, phone?: string | null): boolean {
  if (
    analysis.recommended_actions.some((action) =>
      /callback|call_back|followup|follow_up|콜백|회신|연락/i.test(
        `${action.action_type} ${action.title}`,
      ),
    )
  ) {
    return true;
  }

  return Boolean(phone?.trim()) && CALLBACK_INTENTS.has(analysis.primary_intent);
}

/** OpsInbox용 다줄 summary (유형 / 요약 / 콜백) */
export function buildStructuredPendingSummary(
  analysis: AnalysisResult,
  phone?: string | null,
  options?: { uncertain?: TranscriptUncertaintyAssessment | null },
): string {
  const uncertain = options?.uncertain;
  if (uncertain?.isUncertain) {
    return [uncertain.typeLabel, uncertain.detailSummary].join("\n");
  }

  const typeLabel =
    INTENT_TYPE_LABEL[analysis.primary_intent] ?? "통화 문의";

  if (isReservationStaffIntent(analysis.primary_intent)) {
    const staff = buildReservationStaffContext(analysis, phone);
    if (staff) {
      const lines = [typeLabel, ...buildReservationStaffSummaryLines(analysis, staff)];
      if (suggestsCallback(analysis, phone)) lines.push("콜백 요청");
      return lines.join("\n");
    }
  }

  const lines = [typeLabel, analysis.summary.trim()];

  if (suggestsCallback(analysis, phone)) {
    lines.push("콜백 요청");
  }

  return lines.join("\n");
}

export type { PendingEventType };

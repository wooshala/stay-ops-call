import { buildManualReviewAnalysisResult } from "@/lib/analysis/manualReview";
import type { AnalysisResult } from "@/lib/analysis/schema";
import { safeParseAnalysisJson } from "@/lib/analysis/schema";

/**
 * LLM JSON 실패 시 최소 안전망. 정답기가 아니라 항상 저장 가능한 스키마 준수 결과.
 */
export function fallbackAnalysisResult(text: string): AnalysisResult {
  const t = text.trim().slice(0, 2000);
  const summary =
    t.length > 200 ? `${t.slice(0, 197)}…` : t || "통화 요약을 자동으로 만들지 못했습니다.";

  let primary_intent: AnalysisResult["primary_intent"] = "other";
  if (/불만|환불|취소|민원|컴플레인|불편|너무\s*시끄|청결|냄새|곰팡이/i.test(t)) {
    primary_intent = "complaint";
  } else if (/수리|고장|누수|전기|냉난방|온도|보일러|수도/i.test(t)) {
    primary_intent = "maintenance";
  } else if (/단체|견적|패키지|행사|워크숍|몇\s*실|객실\s*수/i.test(t)) {
    primary_intent = "quotation_intent";
  } else if (/결제|입금|카드|계좌|계약금|예약금/i.test(t)) {
    primary_intent = "payment";
  } else if (/연장|늦게|한\s*박\s*더|추가\s*숙박/i.test(t)) {
    primary_intent = "extension_request";
  } else if (/수건|칫솔|비품|드라이|추가\s*요청|배달|전달/i.test(t)) {
    primary_intent = "service_request";
  } else if (/예약|숙박|체크인|체크\s*아웃|객실\s*있|방\s*있|당일|내일|모레/i.test(t)) {
    primary_intent = "reservation_inquiry";
  } else if (/얼마|가격|요금|비용|할인|객실료/i.test(t)) {
    primary_intent = "rate_inquiry";
  }

  const candidate = {
    summary: `${summary} (휴리스틱 보정)`,
    primary_intent,
    secondary_tags: ["llm_parse_fallback"],
    actionable_secondary_intents: null as AnalysisResult["actionable_secondary_intents"],
    confidence: 0.35,
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
        action_type: "review_transcript",
        title: "원문 확인 권장",
        description:
          "자동 분석 JSON이 불완전하여 키워드 기반으로만 분류했습니다. 필요 시 녹음·원문을 확인하세요.",
        priority: "normal",
      },
    ],
  };

  const parsed = safeParseAnalysisJson(candidate);
  if (parsed.success) return parsed.data;
  return buildManualReviewAnalysisResult("휴리스틱 후보 스키마 검증 실패");
}

import type { AnalysisResult } from "@/lib/analysis/schema";
import { MOCK_STT_SAMPLES } from "@/lib/stt/samples";

/** Pre-built analysis outputs aligned with MOCK_STT_SAMPLES */
export const MOCK_ANALYSIS_BY_SAMPLE_INDEX: readonly AnalysisResult[] = [
  {
    summary:
      "605호 고객이 객실로 수건을 추가로 전달해 달라고 요청했습니다.",
    primary_intent: "service_request",
    secondary_tags: ["room_mentioned", "urgent_issue"],
    confidence: 0.91,
    entities: {
      room_no: "605",
      guest_name: null,
      issue_type: null,
      item_requested: "수건",
      quantity: null,
      unit: "개",
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
        action_type: "deliver_amenities",
        title: "605호 수건 추가 전달",
        description: "요청 수량을 확인한 뒤 하우스키핑 또는 프런트에서 전달하세요.",
        priority: "normal",
      },
    ],
  },
  {
    summary:
      "303호 고객이 보일러 온도가 과도하게 높다고 하여 객실 설비 점검이 필요합니다.",
    primary_intent: "maintenance",
    secondary_tags: ["room_mentioned", "urgent_issue"],
    confidence: 0.89,
    entities: {
      room_no: "303",
      guest_name: null,
      issue_type: "보일러 과열",
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
        action_type: "maintenance_check",
        title: "303호 보일러/난방 점검",
        description: "안전을 위해 설비 담당자에게 점검을 요청하세요.",
        priority: "high",
      },
    ],
  },
  {
    summary: "당일 스탠다드 객실 요금을 문의하는 외부 고객 통화입니다.",
    primary_intent: "rate_inquiry",
    secondary_tags: ["price_check", "room_mentioned"],
    confidence: 0.93,
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
        action_type: "rate_followup",
        title: "가격 문의 고객 정보 기록",
        description: "요금 정책 안내 내용을 phone DB에 반영하고 리드로 관리하세요.",
        priority: "low",
      },
    ],
  },
  {
    summary:
      "28일 투숙 예정이며 3명 투숙 시 침대 구성(구성 안내)을 문의했습니다.",
    primary_intent: "reservation_inquiry",
    secondary_tags: ["bed_configuration", "room_mentioned"],
    confidence: 0.86,
    entities: {
      room_no: null,
      guest_name: null,
      issue_type: null,
      item_requested: null,
      quantity: null,
      unit: null,
      arrival_eta: null,
      occupancy_count: 3,
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
        action_type: "reservation_lead",
        title: "예약 리드 확인",
        description: "인원/침대 구성 가능 여부를 확인하고 후속 연락을 남기세요.",
        priority: "normal",
      },
    ],
  },
  {
    summary:
      "청소팀이 카드키를 잘못 눌러서 고객이 놀란 상황에 대한 컴플레인입니다.",
    primary_intent: "complaint",
    secondary_tags: ["staff_mistake", "urgent_issue"],
    actionable_secondary_intents: ["extension_request"],
    confidence: 0.88,
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
      complaint_reason: "청소팀 카드키 오조작",
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
        action_type: "cs_followup",
        title: "CS 확인 및 재발 방지",
        description: "청소 프로세스와 키 사용 안내를 점검하고 고객에게 사과/안내를 검토하세요.",
        priority: "high",
      },
    ],
  },
  {
    summary:
      "예약 계약금을 카드로 결제하고 영수증을 이메일로 받기를 요청한 통화입니다.",
    primary_intent: "payment",
    secondary_tags: ["payment", "receipt"],
    confidence: 0.87,
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
      amount: 500000,
      payment_method: "card",
      payment_deposit: true,
      group_booking: false,
      room_count: null,
      deposit_amount: null,
      parking_count: null,
    },
    recommended_actions: [
      {
        action_type: "payment_confirm",
        title: "입금·영수증 확인",
        description: "결제 반영 및 영수증 발송 여부를 확인하세요.",
        priority: "normal",
      },
    ],
  },
  {
    summary:
      "단체 워크숍용 객실 다수·인원·주차·총액을 포함한 견적 문의 통화입니다.",
    primary_intent: "quotation_intent",
    secondary_tags: ["group_booking", "price_check"],
    confidence: 0.84,
    entities: {
      room_no: null,
      guest_name: null,
      issue_type: null,
      item_requested: null,
      quantity: null,
      unit: null,
      arrival_eta: null,
      occupancy_count: 80,
      checkin_date: "3월 5일",
      checkout_date: null,
      quoted_price: 8000000,
      complaint_reason: null,
      amount: null,
      payment_method: "card",
      payment_deposit: null,
      group_booking: true,
      room_count: 20,
      deposit_amount: null,
      parking_count: 15,
    },
    recommended_actions: [
      {
        action_type: "quotation_followup",
        title: "단체 견적서 발송",
        description: "객실 가용·세금·취소 규정을 확인한 뒤 공식 견적을 발송하세요.",
        priority: "normal",
      },
    ],
  },
];

export function findSampleIndexForTranscript(transcript: string): number | null {
  const t = transcript.trim();
  for (let i = 0; i < MOCK_STT_SAMPLES.length; i++) {
    if (t.includes(MOCK_STT_SAMPLES[i]!.slice(0, 8))) {
      return i;
    }
  }
  if (t.includes("605") && t.includes("수건")) return 0;
  if (t.includes("303") && t.includes("보일러")) return 1;
  if (t.includes("스탠다드") && t.includes("얼마")) return 2;
  if (t.includes("28일") && t.includes("침대")) return 3;
  if (t.includes("카드키") || t.includes("청소팀")) return 4;
  if (t.includes("계약금") && (t.includes("영수증") || t.includes("카드"))) return 5;
  if (t.includes("단체") && t.includes("견적")) return 6;
  return null;
}

export function getMockAnalysisForTranscript(transcript: string): AnalysisResult {
  const idx = findSampleIndexForTranscript(transcript);
  if (idx !== null) {
    return MOCK_ANALYSIS_BY_SAMPLE_INDEX[idx]!;
  }
  return {
    summary: "통화 내용을 간단히 요약하면, 일반 문의 또는 기타 요청으로 분류됩니다.",
    primary_intent: "other",
    secondary_tags: [],
    confidence: 0.55,
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
        title: "내용 수동 확인",
        description: "패턴이 불명확하므로 통화 메모와 함께 담당자가 확인하세요.",
        priority: "low",
      },
    ],
  };
}

import { RoomType, StayType, WeekdayKey } from "./types";

const ROOM_LABELS: Record<RoomType, string> = {
  standard: "일반실",
  deluxe: "디럭스",
  suite: "스위트",
};

const STAY_TYPE_LABELS: Record<StayType, string> = {
  overnight: "숙박",
  dayuse: "대실",
};

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  sunday: "일요일",
  monday: "월요일",
  tuesday: "화요일",
  wednesday: "수요일",
  thursday: "목요일",
  friday: "금요일",
  saturday: "토요일",
};

function formatPrice(value: number | null): string {
  if (value === null) return "가격 확인 필요";
  return `${value.toLocaleString("ko-KR")}원`;
}

export interface QuoteMessageInput {
  requestedDate: string | null;
  requestedWeekday: WeekdayKey | null;
  stayType: StayType;
  roomType: RoomType | null;
  price: number | null;
  needsDateConfirmation?: boolean;
}

export function roomTypeLabel(roomType: RoomType): string {
  return ROOM_LABELS[roomType];
}

export function renderQuoteMessage(input: QuoteMessageInput): string {
  const dateText = input.requestedDate
    ? `${input.requestedDate}`
    : input.requestedWeekday
      ? `${WEEKDAY_LABELS[input.requestedWeekday]} 기준`
      : "날짜 확인 필요";

  const roomText = input.roomType ? ROOM_LABELS[input.roomType] : "객실 선택 필요";
  const stayText = STAY_TYPE_LABELS[input.stayType];
  const priceText = formatPrice(input.price);

  const lines = [
    "안녕하세요. stay-ops-call입니다.",
    `문의 주신 ${stayText} 견적 안내드립니다.`,
    `- 일정: ${dateText}`,
    `- 객실: ${roomText}`,
    `- 금액: ${priceText}`,
  ];

  if (input.needsDateConfirmation) {
    lines.push("- 안내: 정확한 날짜 확인 시 최종 금액이 확정됩니다.");
  }

  lines.push("원하시는 객실 타입 회신 주시면 바로 예약 도와드리겠습니다.");

  return lines.join("\n");
}

import type { QuotationExtraction } from "@/lib/quotation/types";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  return String(v);
}

function fmtWon(n: unknown): string {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString("ko-KR")}원`;
}

/**
 * 병합된 entities + 원시 견적 추출 → 견적서 초안 텍스트.
 */
export function buildQuoteDraftFromExtracted(
  entities: Record<string, unknown>,
  quotationExtraction: QuotationExtraction | null,
): string {
  const q = quotationExtraction ?? {};
  const checkin = entities.checkin_date ?? q.checkin_date;
  const checkout = entities.checkout_date ?? q.checkout_date;
  const dateLine =
    checkin || checkout
      ? [checkin, checkout].filter(Boolean).join(" ~ ")
      : "—";

  const lines = [
    "[견적서 초안]",
    "",
    `• 고객/단체명: ${fmt(entities.guest_name)}`,
    `• 객실 호수(확정 시): ${fmt(entities.room_no)}`,
    `• 일정: ${dateLine}`,
    `• 객실 수: ${fmt(entities.room_count ?? q.room_count)}`,
    `• 견적 금액: ${fmtWon(entities.quoted_price ?? q.total_price)}`,
    `• 결제 방식: ${fmt(entities.payment_method ?? q.payment_method)}`,
    `• 예약금: ${fmtWon(entities.deposit_amount ?? q.deposit_amount)}`,
    `• 인원: ${fmt(entities.occupancy_count ?? q.headcount)}`,
    `• 주차: ${fmt(entities.parking_count ?? q.parking_count)}`,
    "",
    "※ 자동 생성 초안이며, 최종 견적은 담당자 확인이 필요합니다.",
  ];

  return lines.join("\n");
}

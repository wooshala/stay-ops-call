import type { AnalysisResult } from "@/lib/analysis/schema";
import type { QuotationExtraction } from "@/lib/quotation/types";

const GROUP_HINT = /단체|견적|패키지|행사|워크숍|객실\s*수|몇\s*실|주차/;

/**
 * 휴리스틱 견적 추출값을 LLM entities에 병합한다 (비어 있는 필드만 보강).
 */
export function mergeQuotationIntoEntities(
  entities: AnalysisResult["entities"],
  q: QuotationExtraction,
  contextText?: string,
): AnalysisResult["entities"] {
  const hintGroup =
    contextText && GROUP_HINT.test(contextText) ? true : null;
  return {
    ...entities,
    checkin_date: entities.checkin_date ?? q.checkin_date ?? null,
    checkout_date: entities.checkout_date ?? q.checkout_date ?? null,
    room_count: entities.room_count ?? q.room_count ?? null,
    quoted_price: entities.quoted_price ?? q.total_price ?? null,
    deposit_amount: entities.deposit_amount ?? q.deposit_amount ?? null,
    payment_method: entities.payment_method ?? q.payment_method ?? null,
    occupancy_count: entities.occupancy_count ?? q.headcount ?? null,
    parking_count: entities.parking_count ?? q.parking_count ?? null,
    payment_deposit:
      entities.payment_deposit ??
      (q.deposit_amount != null && q.deposit_amount > 0 ? true : null),
    group_booking: entities.group_booking ?? hintGroup,
  };
}

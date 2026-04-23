import { z } from "zod";

/** 휴리스틱 견적 추출 결과 (LLM entities와 병합) */
export const QuotationExtractionSchema = z.object({
  checkin_date: z.string().nullable().optional(),
  checkout_date: z.string().nullable().optional(),
  /** 객실 수(실·개) */
  room_count: z.number().int().nullable().optional(),
  /** 총액·견적가 */
  total_price: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  /** 예약금 금액 */
  deposit_amount: z.number().nullable().optional(),
  /** 인원 */
  headcount: z.number().int().nullable().optional(),
  /** 주차 대수 */
  parking_count: z.number().int().nullable().optional(),
});

export type QuotationExtraction = z.infer<typeof QuotationExtractionSchema>;

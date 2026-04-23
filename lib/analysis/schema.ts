import { z } from "zod";

export const PrimaryIntentSchema = z.enum([
  "maintenance",
  "service_request",
  "reservation_inquiry",
  "rate_inquiry",
  "extension_request",
  "complaint",
  "payment",
  /** 단체·견적·패키지 등 견적 중심 문의 (일반 예약 문의와 구분) */
  "quotation_intent",
  /** 체크인·체크아웃·연장 요청 (extension_request 대체) */
  "checkin_checkout",
  /** 취소 요청 — 자동 라우팅 보류 */
  "cancel_request",
  /** 환불 요청 — 자동 라우팅 보류 */
  "refund_request",
  /** 주차 문의 — 자동 라우팅 보류 */
  "parking",
  "other",
  "manual_review_required",
]);

export const EntitiesSchema = z.object({
  room_no: z.string().nullable().optional(),
  guest_name: z.string().nullable().optional(),
  issue_type: z.string().nullable().optional(),
  item_requested: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  arrival_eta: z.string().nullable().optional(),
  occupancy_count: z.number().int().nullable().optional(),
  checkin_date: z.string().nullable().optional(),
  checkout_date: z.string().nullable().optional(),
  quoted_price: z.number().nullable().optional(),
  complaint_reason: z.string().nullable().optional(),
  /** 결제·견적 금액 */
  amount: z.number().nullable().optional(),
  /** 카드, 계좌이체, 현금 등 */
  payment_method: z.string().nullable().optional(),
  /** 계약금·예약금 성격 */
  payment_deposit: z.boolean().nullable().optional(),
  /** 단체·다인 예약 */
  group_booking: z.boolean().nullable().optional(),
  /** 견적·단체: 객실 수(실·개) */
  room_count: z.number().int().nullable().optional(),
  /** 예약금·계약금 금액(원) */
  deposit_amount: z.number().nullable().optional(),
  /** 주차 대수 */
  parking_count: z.number().int().nullable().optional(),
});

export const RecommendedActionSchema = z.object({
  action_type: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  primary_intent: PrimaryIntentSchema,
  secondary_tags: z.array(z.string()).default([]),
  /** 복합 의도: 워크플로는 primary만 생성; 참고용 보조 의도(다음 단계 확장 예정) */
  actionable_secondary_intents: z
    .array(PrimaryIntentSchema)
    .nullable()
    .optional(),
  confidence: z.number().min(0).max(1),
  entities: EntitiesSchema,
  recommended_actions: z.array(RecommendedActionSchema),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export function parseAnalysisJson(raw: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(raw);
}

export function safeParseAnalysisJson(raw: unknown) {
  return AnalysisResultSchema.safeParse(raw);
}

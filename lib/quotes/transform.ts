import type { QuoteDraft } from "@/services/quote-engine";

export type QuoteSourceKind = "auto" | "manual";

export interface CreateQuoteInput {
  call_id: string | null;
  customer_phone_number: string | null;
  requested_date: string | null;
  requested_weekday: string | null;
  stay_type: string;
  room_type: string | null;
  quoted_price: number | null;
  message_body: string;
  quote_status: "confirmed" | "sent";
  source_kind: QuoteSourceKind;
  source_system: string | null;
  source_reference_id: string | null;
  finalized_by: string | null;
  finalized_at: string;
  sent_at: string | null;
  metadata_json: Record<string, unknown> | null;
}

export function quoteDraftToCreateQuoteInput(input: {
  callId: string;
  draft: QuoteDraft;
  sourceKind?: QuoteSourceKind;
  sourceSystem?: string | null;
  sourceReferenceId?: string | null;
  finalizedBy?: string | null;
  markAsSent?: boolean;
  now?: Date;
}): CreateQuoteInput {
  const nowIso = (input.now ?? new Date()).toISOString();
  const markAsSent = input.markAsSent === true;
  return {
    call_id: input.callId,
    customer_phone_number: input.draft.phoneNumber,
    requested_date: input.draft.requestedDate,
    requested_weekday: input.draft.requestedWeekday,
    stay_type: input.draft.stayType,
    room_type: input.draft.selectedRoomType,
    quoted_price: input.draft.priceSnapshot.price,
    message_body: input.draft.messageDraft,
    quote_status: markAsSent ? "sent" : "confirmed",
    source_kind: input.sourceKind ?? "auto",
    source_system: input.sourceSystem ?? "web_quote_engine",
    source_reference_id: input.sourceReferenceId ?? null,
    finalized_by: input.finalizedBy ?? null,
    finalized_at: nowIso,
    sent_at: markAsSent ? nowIso : null,
    metadata_json: {
      priceSnapshot: input.draft.priceSnapshot,
      needsReviewReason: input.draft.needsReviewReason,
      needsReviewReasons: input.draft.needsReviewReasons,
      inquiryType: input.draft.inquiryType,
      draftStatus: input.draft.status,
    },
  };
}

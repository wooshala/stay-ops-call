export type StayType = "overnight" | "dayuse";

export type RoomType = "standard" | "deluxe" | "suite";

export type QuoteDraftStatus = "draft" | "sent" | "archived" | "needs_review";

export type InquiryType = "price" | "reservation" | "unknown";

export type PricingSource =
  | "date_exact"
  | "weekday"
  | "today_fallback"
  | "stay_fallback"
  | "pricing_table_missing";

export interface MockCallInput {
  id: string;
  phone_number?: string | null;
  source_file_name?: string | null;
  transcript?: string | null;
  summary?: string | null;
  analysis_result?: Record<string, unknown> | null;
  requested_date?: string | null;
  requested_weekday?: string | null;
  stay_type?: string | null;
  room_type_candidate?: string | null;
  inquiry_type?: string | null;
}

export interface ExtractedQuoteInputs {
  phoneNumber: string | null;
  requestedDate: string | null;
  requestedWeekday: WeekdayKey | null;
  stayType: StayType | null;
  roomTypeCandidate: RoomType | null;
  inquiryType: InquiryType;
  confidence: number;
  sourceFileName: string | null;
  callSummary: string;
}

export type WeekdayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export interface PriceRow {
  roomType: RoomType;
  stayType: StayType;
  weekday: number; // 0 (Sun) - 6 (Sat)
  price: number;
}

export interface PriceLookupInput {
  requestedDate: string | null;
  requestedWeekday: WeekdayKey | null;
  stayType: StayType | null;
  roomType: RoomType;
  now?: Date;
}

export interface PriceLookupResult {
  roomType: RoomType;
  stayType: StayType;
  price: number;
  pricingSource: PricingSource;
  appliedDate: string;
  appliedWeekday: WeekdayKey;
}

export interface QuoteCandidate {
  roomType: RoomType;
  roomTypeLabel: string;
  quotedPrice: number | null;
  pricingSource: PricingSource | null;
  isDefault: boolean;
}

export interface QuoteDraft {
  id: string;
  callId: string;
  phoneNumber: string | null;
  sourceFileName: string | null;
  callSummary: string;
  requestedDate: string | null;
  requestedWeekday: WeekdayKey | null;
  stayType: StayType;
  selectedRoomType: RoomType | null;
  status: QuoteDraftStatus;
  messageDraft: string;
  priceSnapshot: {
    roomType: RoomType | null;
    price: number | null;
    pricingSource: PricingSource | null;
    appliedDate: string | null;
  };
  candidates: QuoteCandidate[];
  isPhoneNumberValid: boolean;
  needsReviewReason: string | null;
  needsReviewReasons: string[];
  inquiryType: InquiryType;
  createdAt: string;
  updatedAt: string;
}

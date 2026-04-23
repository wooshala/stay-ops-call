import { getQuotePrice } from "./pricing";
import { renderQuoteMessage, roomTypeLabel } from "./template";
import { QuoteDraft, RoomType, WeekdayKey } from "./types";

const WEEKDAY_KEYS: WeekdayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function normalizeRequestedWeekday(value: WeekdayKey | null): WeekdayKey | null {
  if (!value) return null;
  return WEEKDAY_KEYS.includes(value) ? value : null;
}

function toIsoTimestamp(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

export function rebuildQuoteDraftByRoomType(
  draft: QuoteDraft,
  roomType: RoomType,
  now?: Date,
): QuoteDraft {
  const requestedWeekday = normalizeRequestedWeekday(draft.requestedWeekday);

  const priced = getQuotePrice({
    requestedDate: draft.requestedDate,
    requestedWeekday,
    stayType: draft.stayType,
    roomType,
    now,
  });

  const selectedPrice = priced.pricingSource === "pricing_table_missing" ? null : priced.price;
  const selectedPricingSource = priced.pricingSource === "pricing_table_missing" ? null : priced.pricingSource;
  const needsDateConfirmation = draft.requestedDate === null && requestedWeekday === null;

  const messageDraft = renderQuoteMessage({
    requestedDate: draft.requestedDate,
    requestedWeekday,
    stayType: draft.stayType,
    roomType,
    price: selectedPrice,
    needsDateConfirmation,
  });

  const nextCandidates = draft.candidates.map((candidate) => {
    if (candidate.roomType === roomType) {
      return {
        ...candidate,
        roomTypeLabel: roomTypeLabel(roomType),
        quotedPrice: selectedPrice,
        pricingSource: selectedPricingSource,
        isDefault: true,
      };
    }
    return {
      ...candidate,
      isDefault: false,
    };
  });

  const hasSelectedCandidate = nextCandidates.some((candidate) => candidate.roomType === roomType);
  const candidates = hasSelectedCandidate
    ? nextCandidates
    : [
        ...nextCandidates,
        {
          roomType,
          roomTypeLabel: roomTypeLabel(roomType),
          quotedPrice: selectedPrice,
          pricingSource: selectedPricingSource,
          isDefault: true,
        },
      ];

  const needsReviewReasons = [
    draft.isPhoneNumberValid ? null : "전화번호 확인 필요",
    selectedPrice === null ? "가격표 확인 필요" : null,
  ].filter((value): value is string => value !== null);

  return {
    ...draft,
    requestedWeekday,
    selectedRoomType: roomType,
    status: needsReviewReasons.length === 0 ? "draft" : "needs_review",
    messageDraft,
    priceSnapshot: {
      roomType,
      price: selectedPrice,
      pricingSource: selectedPricingSource,
      appliedDate: priced.appliedDate,
    },
    candidates,
    needsReviewReason: needsReviewReasons[0] ?? null,
    needsReviewReasons,
    updatedAt: toIsoTimestamp(now),
  };
}

import { extractQuoteInputs } from "./extractQuoteInputs";
import { getDefaultRoomTypeCandidates, getQuotePrice } from "./pricing";
import { renderQuoteMessage, roomTypeLabel } from "./template";
import { MockCallInput, QuoteDraft, RoomType } from "./types";
import { isValidPhoneNumber, normalizePhoneNumber, validateExtractedInputs } from "./validators";

function toIsoTimestamp(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function buildDraftId(callId: string): string {
  return `qd_${callId}`;
}

function sortRoomTypes(types: RoomType[]): RoomType[] {
  const order: Record<RoomType, number> = { standard: 0, deluxe: 1, suite: 2 };
  return [...types].sort((a, b) => order[a] - order[b]);
}

export function buildQuoteDraft(call: MockCallInput, now?: Date): QuoteDraft {
  const extracted = extractQuoteInputs(call);
  const normalizedPhone = normalizePhoneNumber(extracted.phoneNumber);
  const validation = validateExtractedInputs({
    ...extracted,
    phoneNumber: normalizedPhone,
  });

  const stayType = extracted.stayType ?? "overnight";
  const candidatesByPriority = getDefaultRoomTypeCandidates(extracted.roomTypeCandidate);
  const candidateRoomTypes = sortRoomTypes(candidatesByPriority.slice(0, 3));
  const selectedRoomType = extracted.roomTypeCandidate;

  const candidates = candidateRoomTypes.map((roomType) => {
    const priced = getQuotePrice({
      requestedDate: extracted.requestedDate,
      requestedWeekday: extracted.requestedWeekday,
      stayType,
      roomType,
      now,
    });
    return {
      roomType,
      roomTypeLabel: roomTypeLabel(roomType),
      quotedPrice: priced.pricingSource === "pricing_table_missing" ? null : priced.price,
      pricingSource: priced.pricingSource === "pricing_table_missing" ? null : priced.pricingSource,
      isDefault: roomType === (selectedRoomType ?? candidateRoomTypes[0]),
    };
  });

  const selectedCandidate = candidates.find((c) => c.roomType === (selectedRoomType ?? candidates[0]?.roomType));

  const selectedPrice = selectedCandidate?.quotedPrice ?? null;
  const selectedPricingSource = selectedCandidate?.pricingSource ?? null;
  const needsDateConfirmation = extracted.requestedDate === null && extracted.requestedWeekday === null;

  const messageDraft = renderQuoteMessage({
    requestedDate: extracted.requestedDate,
    requestedWeekday: extracted.requestedWeekday,
    stayType,
    roomType: selectedCandidate?.roomType ?? null,
    price: selectedPrice,
    needsDateConfirmation,
  });

  const status = validation.canAutoSend && selectedPrice !== null ? "draft" : "needs_review";
  const nowIso = toIsoTimestamp(now);
  const needsReviewReasons = [
    validation.needsReviewReason,
    selectedPrice === null ? "가격표 확인 필요" : null,
    extracted.stayType === null ? "숙박/대실 확인 필요" : null,
  ].filter((value): value is string => value !== null);

  return {
    id: buildDraftId(call.id),
    callId: call.id,
    phoneNumber: normalizedPhone,
    sourceFileName: extracted.sourceFileName,
    callSummary: extracted.callSummary,
    requestedDate: extracted.requestedDate,
    requestedWeekday: extracted.requestedWeekday,
    stayType,
    selectedRoomType: selectedCandidate?.roomType ?? null,
    status,
    messageDraft,
    priceSnapshot: {
      roomType: selectedCandidate?.roomType ?? null,
      price: selectedPrice,
      pricingSource: selectedPricingSource,
      appliedDate: extracted.requestedDate ?? (extracted.requestedWeekday ? "weekday-only" : "today"),
    },
    candidates,
    isPhoneNumberValid: isValidPhoneNumber(normalizedPhone),
    needsReviewReason: needsReviewReasons[0] ?? null,
    needsReviewReasons,
    inquiryType: extracted.inquiryType,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

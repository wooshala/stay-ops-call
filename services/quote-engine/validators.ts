import { ExtractedQuoteInputs, StayType } from "./types";

const PHONE_DIGIT_MIN = 9;
const PHONE_DIGIT_MAX = 12;

export function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

export function isValidPhoneNumber(value: string | null): boolean {
  if (!value) return false;
  return value.length >= PHONE_DIGIT_MIN && value.length <= PHONE_DIGIT_MAX;
}

export function normalizeStayType(value: string | null | undefined): StayType | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (["overnight", "숙박", "stay"].includes(normalized)) return "overnight";
  if (["dayuse", "대실", "rent"].includes(normalized)) return "dayuse";
  return null;
}

export function validateExtractedInputs(
  input: ExtractedQuoteInputs,
): { canAutoSend: boolean; needsReviewReason: string | null } {
  const normalizedPhone = normalizePhoneNumber(input.phoneNumber);
  const phoneValid = isValidPhoneNumber(normalizedPhone);

  if (!phoneValid) {
    return {
      canAutoSend: false,
      needsReviewReason: "전화번호 확인 필요",
    };
  }

  return {
    canAutoSend: true,
    needsReviewReason: null,
  };
}

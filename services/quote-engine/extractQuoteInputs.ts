import { ExtractedQuoteInputs, MockCallInput, RoomType, WeekdayKey } from "./types";
import { normalizePhoneNumber, normalizeStayType } from "./validators";

const WEEKDAY_MAP: Record<string, WeekdayKey> = {
  sun: "sunday",
  sunday: "sunday",
  일: "sunday",
  mon: "monday",
  monday: "monday",
  월: "monday",
  tue: "tuesday",
  tuesday: "tuesday",
  화: "tuesday",
  wed: "wednesday",
  wednesday: "wednesday",
  수: "wednesday",
  thu: "thursday",
  thursday: "thursday",
  목: "thursday",
  fri: "friday",
  friday: "friday",
  금: "friday",
  sat: "saturday",
  saturday: "saturday",
  토: "saturday",
};

const ROOM_TYPE_KEYWORDS: Record<string, RoomType> = {
  일반실: "standard",
  standard: "standard",
  디럭스: "deluxe",
  deluxe: "deluxe",
  스위트: "suite",
  suite: "suite",
};

function normalizeWeekday(value: string | null | undefined): WeekdayKey | null {
  if (!value) return null;
  const key = value.toLowerCase().trim();
  return WEEKDAY_MAP[key] ?? null;
}

function normalizeRoomTypeCandidate(value: string | null | undefined): RoomType | null {
  if (!value) return null;
  const key = value.toLowerCase().trim();
  const directMatch = ROOM_TYPE_KEYWORDS[key];
  if (directMatch) return directMatch;

  for (const keyword of Object.keys(ROOM_TYPE_KEYWORDS)) {
    if (value.toLowerCase().includes(keyword.toLowerCase())) {
      return ROOM_TYPE_KEYWORDS[keyword];
    }
  }
  return null;
}

function normalizeInquiryType(value: string | null | undefined): "price" | "reservation" | "unknown" {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (normalized.includes("가격") || normalized.includes("price")) return "price";
  if (normalized.includes("예약") || normalized.includes("reservation")) return "reservation";
  return "unknown";
}

function resolveRequestedDate(call: MockCallInput): string | null {
  const dateValue =
    (typeof call.analysis_result?.requested_date === "string"
      ? (call.analysis_result.requested_date as string)
      : null) ?? call.requested_date;

  if (!dateValue) return null;
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  return isoDatePattern.test(dateValue) ? dateValue : null;
}

function resolveRequestedWeekday(call: MockCallInput): WeekdayKey | null {
  const weekdayValue =
    (typeof call.analysis_result?.requested_weekday === "string"
      ? (call.analysis_result.requested_weekday as string)
      : null) ?? call.requested_weekday;
  return normalizeWeekday(weekdayValue);
}

function resolveStayType(call: MockCallInput) {
  const stayValue =
    (typeof call.analysis_result?.stay_type === "string"
      ? (call.analysis_result.stay_type as string)
      : null) ?? call.stay_type;
  return normalizeStayType(stayValue);
}

function resolveRoomTypeCandidate(call: MockCallInput) {
  const roomValue =
    (typeof call.analysis_result?.room_type_candidate === "string"
      ? (call.analysis_result.room_type_candidate as string)
      : null) ?? call.room_type_candidate;
  return normalizeRoomTypeCandidate(roomValue);
}

export function extractQuoteInputs(call: MockCallInput): ExtractedQuoteInputs {
  const phoneRaw =
    (typeof call.analysis_result?.phone_number === "string"
      ? (call.analysis_result.phone_number as string)
      : null) ?? call.phone_number;

  return {
    phoneNumber: normalizePhoneNumber(phoneRaw),
    requestedDate: resolveRequestedDate(call),
    requestedWeekday: resolveRequestedWeekday(call),
    stayType: resolveStayType(call),
    roomTypeCandidate: resolveRoomTypeCandidate(call),
    inquiryType: normalizeInquiryType(
      (typeof call.analysis_result?.inquiry_type === "string"
        ? (call.analysis_result.inquiry_type as string)
        : null) ?? call.inquiry_type,
    ),
    confidence: 0.8,
    sourceFileName: call.source_file_name ?? null,
    callSummary: call.summary ?? "",
  };
}

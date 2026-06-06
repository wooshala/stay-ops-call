import type { AnalysisResult } from "./schema";

export const RESERVATION_STAFF_INTENTS = new Set<string>([
  "reservation_inquiry",
  "rate_inquiry",
  "extension_request",
  "quotation_intent",
  "checkin_checkout",
]);

export type StaffFieldKey =
  | "usage_date"
  | "checkin_time"
  | "room_type"
  | "room_count"
  | "amount"
  | "vehicle_count"
  | "guest_name"
  | "contact"
  | "booking_status";

export const STAFF_FIELD_LABELS: Record<StaffFieldKey, string> = {
  usage_date: "이용일",
  checkin_time: "입실시간",
  room_type: "객실타입",
  room_count: "객실수",
  amount: "금액",
  vehicle_count: "차량대수",
  guest_name: "고객명",
  contact: "연락처",
  booking_status: "예약상태",
};

export type ReservationStaffFields = Record<StaffFieldKey, string | number | null>;

export function isReservationStaffIntent(
  intent: AnalysisResult["primary_intent"] | string | null | undefined,
): boolean {
  return Boolean(intent && RESERVATION_STAFF_INTENTS.has(intent));
}

function pickString(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function pickNumber(...values: Array<number | null | undefined>): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export function buildReservationStaffFields(
  analysis: AnalysisResult,
  phone?: string | null,
): ReservationStaffFields {
  const rs = analysis.reservation_staff;
  const e = analysis.entities;
  const callPhone = phone?.trim() || null;

  return {
    usage_date: pickString(rs?.usage_date, e.checkin_date),
    checkin_time: pickString(rs?.checkin_time, e.arrival_eta),
    room_type: pickString(rs?.room_type, e.room_type),
    room_count: pickNumber(rs?.room_count, e.room_count),
    amount: pickNumber(rs?.amount, e.amount, e.quoted_price, e.deposit_amount),
    vehicle_count: pickNumber(rs?.vehicle_count, e.parking_count),
    guest_name: pickString(rs?.guest_name, e.guest_name),
    contact: callPhone ?? pickString(rs?.contact),
    booking_status: pickString(rs?.booking_status),
  };
}

export function computeMissingStaffFieldLabels(
  fields: ReservationStaffFields,
  phone?: string | null,
): string[] {
  const missing: string[] = [];
  if (!fields.usage_date) missing.push(STAFF_FIELD_LABELS.usage_date);
  if (!fields.checkin_time) missing.push(STAFF_FIELD_LABELS.checkin_time);
  if (!fields.room_type) missing.push(STAFF_FIELD_LABELS.room_type);
  if (fields.room_count == null) missing.push(STAFF_FIELD_LABELS.room_count);
  if (fields.amount == null) missing.push(STAFF_FIELD_LABELS.amount);
  if (fields.vehicle_count == null) missing.push(STAFF_FIELD_LABELS.vehicle_count);
  if (!fields.guest_name) missing.push(STAFF_FIELD_LABELS.guest_name);
  if (!phone?.trim() && !fields.contact) missing.push(STAFF_FIELD_LABELS.contact);
  if (!fields.booking_status) missing.push(STAFF_FIELD_LABELS.booking_status);
  return missing;
}

const FOLLOW_UP_TEMPLATES: Record<string, string> = {
  [STAFF_FIELD_LABELS.usage_date]: "이용일을 확인해야 합니다.",
  [STAFF_FIELD_LABELS.checkin_time]: "입실 시간을 확인해야 합니다.",
  [STAFF_FIELD_LABELS.room_type]: "객실 타입을 확인해야 합니다.",
  [STAFF_FIELD_LABELS.room_count]: "객실 수를 확인해야 합니다.",
  [STAFF_FIELD_LABELS.amount]: "예약 금액을 확인해야 합니다.",
  [STAFF_FIELD_LABELS.vehicle_count]: "차량 대수를 확인해야 합니다.",
  [STAFF_FIELD_LABELS.guest_name]: "고객명을 확인해야 합니다.",
  [STAFF_FIELD_LABELS.contact]: "연락처를 확인해야 합니다.",
  [STAFF_FIELD_LABELS.booking_status]: "예약 확정 여부를 확인해야 합니다.",
};

export function computeFollowUpQuestions(missingLabels: string[]): string[] {
  return missingLabels.map((label) => FOLLOW_UP_TEMPLATES[label] ?? `${label}을(를) 확인해야 합니다.`);
}

export type ReservationStaffContext = {
  fields: ReservationStaffFields;
  missing_fields: string[];
  follow_up_questions: string[];
};

/** LLM 누락 시 STT 원문에서 고객명만 deterministic 추출 */
export function extractGuestNameFromTranscriptPattern(
  transcript: string,
): { guest_name: string; source: "transcript_pattern" } | null {
  const t = transcript.trim();
  if (!t) return null;

  const patterns = [
    /예약자\s*명(?:이|은|는)?\s*([가-힣]{2,4})\s*(?:입니다|이에요|예요|이요)/,
    /예약자명(?:이|은|는)?\s*([가-힣]{2,4})\s*(?:입니다|이에요|예요|이요)/,
    /성함(?:이|은|는)?\s*([가-힣]{2,4})\s*(?:입니다|이에요|예요|이요)/,
    /이름(?:이|은|는)?\s*([가-힣]{2,4})\s*(?:입니다|이에요|예요|이요)/,
  ];

  for (const re of patterns) {
    const name = re.exec(t)?.[1]?.trim();
    if (name) return { guest_name: name, source: "transcript_pattern" };
  }
  return null;
}

export function reservationStaffMetaFromAnalysis(
  analysis: AnalysisResult,
): Record<string, string> {
  const rs = analysis.reservation_staff as Record<string, unknown> | null | undefined;
  const source = typeof rs?.guest_name_source === "string" ? rs.guest_name_source.trim() : "";
  return source ? { guest_name_source: source } : {};
}

function koreanCountWordToNumber(word: string): number | null {
  const map: Record<string, number> = {
    한: 1,
    하나: 1,
    두: 2,
    둘: 2,
    세: 3,
    셋: 3,
    네: 4,
    넷: 4,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
  };
  return map[word] ?? null;
}

export function enrichReservationStaffFromTranscript(
  analysis: AnalysisResult,
  transcript: string,
): AnalysisResult {
  if (!isReservationStaffIntent(analysis.primary_intent)) return analysis;

  const rs = { ...(analysis.reservation_staff ?? {}) };
  const t = transcript;

  if (!rs.usage_date) {
    if (/오늘/.test(t)) rs.usage_date = "오늘";
    else if (/내일/.test(t)) rs.usage_date = "내일";
    else if (/모레/.test(t)) rs.usage_date = "모레";
  }

  if (rs.room_count == null && analysis.entities.quantity != null) {
    const unit = String(analysis.entities.unit ?? "");
    if (/객실|실|룸|방/.test(unit)) rs.room_count = analysis.entities.quantity;
  }

  if (!rs.room_type && /스탠다드/.test(t)) rs.room_type = "스탠다드";
  if (rs.room_count == null || rs.room_count === 0) {
    const roomCountMatch =
      t.match(/스탠다드\s*(\d+)\s*(?:개|실|객실|룸|방)/) ??
      t.match(/스탠다드\s*(한|두|둘|세|셋|네|넷|1|2|3|4)\s*(?:개|실|객실|룸|방)/) ??
      t.match(/(\d+)\s*개\s*예약/) ??
      (rs.room_type ? t.match(/(한|두|둘|세|셋|네|넷|\d+)\s*개/) : null);
    if (roomCountMatch) {
      const raw = roomCountMatch[1]!;
      rs.room_count = /^\d+$/.test(raw) ? Number(raw) : (koreanCountWordToNumber(raw) ?? null);
    }
  }

  if (!rs.checkin_time) {
    const timeMatch = t.match(/(\d{1,2})\s*시(?:에|에요| 정도)?/);
    if (timeMatch) {
      rs.checkin_time = `${String(Number(timeMatch[1])).padStart(2, "0")}:00`;
    }
  }

  if (rs.amount == null) {
    const amountMatch = t.match(/(\d+)\s*만\s*원/);
    if (amountMatch) rs.amount = Number(amountMatch[1]) * 10_000;
  }

  if (rs.vehicle_count == null && analysis.entities.parking_count != null) {
    rs.vehicle_count = analysis.entities.parking_count;
  }

  const vehicleMatch =
    t.match(/차(?:량)?\s*(?:은|는|가)?\s*(두|2|세|3|한|1)\s*대/) ??
    t.match(/(?:한|1)\s*대(?:입니다|이에요|예요|이요)?/);
  if (rs.vehicle_count == null && vehicleMatch) {
    const word = vehicleMatch[1]!;
    rs.vehicle_count =
      word === "두" || word === "한" ? (word === "두" ? 2 : 1) : Number(word);
  }

  let guestName = pickString(rs.guest_name, analysis.entities.guest_name);
  let guestNameSource: string | null = null;
  if (!guestName) {
    const extracted = extractGuestNameFromTranscriptPattern(t);
    if (extracted) {
      guestName = extracted.guest_name;
      rs.guest_name = extracted.guest_name;
      guestNameSource = extracted.source;
    }
  }

  const staffRecord = guestNameSource
    ? ({ ...rs, guest_name_source: guestNameSource } as AnalysisResult["reservation_staff"])
    : rs;

  const entities = guestName
    ? { ...analysis.entities, guest_name: guestName }
    : analysis.entities;

  return { ...analysis, entities, reservation_staff: staffRecord };
}

export function buildReservationStaffContext(
  analysis: AnalysisResult,
  phone?: string | null,
): ReservationStaffContext | null {
  if (!isReservationStaffIntent(analysis.primary_intent)) return null;

  const fields = buildReservationStaffFields(analysis, phone);
  const missing_fields = computeMissingStaffFieldLabels(fields, phone);
  const follow_up_questions = computeFollowUpQuestions(missing_fields);

  return { fields, missing_fields, follow_up_questions };
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** OpsInbox summary 2–3행: 운영 필드 중심 */
export function buildReservationStaffSummaryLines(
  analysis: AnalysisResult,
  staff: ReservationStaffContext,
): string[] {
  const { fields, missing_fields } = staff;
  const head: string[] = [];

  if (fields.usage_date) head.push(String(fields.usage_date));
  if (fields.room_type) head.push(String(fields.room_type));
  if (fields.room_count != null) head.push(`${fields.room_count}객실`);

  let line2 = head.join(" ");
  if (fields.checkin_time) {
    line2 = line2
      ? `${line2}, ${fields.checkin_time} 입실 예정.`
      : `${fields.checkin_time} 입실 예정.`;
  } else if (line2) {
    line2 += ".";
  } else {
    line2 = analysis.summary.trim();
  }

  const lines = [line2];
  if (missing_fields.length > 0) {
    lines.push(`${missing_fields.join("·")} 미확인.`);
  }
  return lines;
}

export function formatStaffFieldValue(
  key: StaffFieldKey,
  fields: ReservationStaffFields,
  phone?: string | null,
): string {
  const value = fields[key];
  if (key === "contact" && phone?.trim()) return phone.trim();
  if (key === "amount" && typeof value === "number") return formatAmount(value);
  if (key === "room_count" && typeof value === "number") return String(value);
  if (key === "vehicle_count" && typeof value === "number") return String(value);
  if (value == null || value === "") return "미확인";
  return String(value);
}

export function isStaffFieldMissing(
  key: StaffFieldKey,
  fields: ReservationStaffFields,
  missingLabels: string[],
  phone?: string | null,
): boolean {
  if (key === "contact" && phone?.trim()) return false;
  return missingLabels.includes(STAFF_FIELD_LABELS[key]);
}

import type { AnalysisResult } from "@/lib/analysis/schema";
import type { CallEntityRow, CallRow } from "@/lib/types/database";
import { OPERATION_CASE_CHANNEL_TYPE, OPERATION_CASE_SEVERITY, OPERATION_CASE_STATUS } from "@/lib/workflows/contract";
import { resolveRoomNo } from "@/lib/utils/roomNo";

function roomNoForWorkflow(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): string | null {
  return resolveRoomNo({
    llmRoomNo: entity?.room_no ?? analysis.entities?.room_no ?? null,
    transcript:
      call.analysis_input_text ??
      call.transcript_cleaned ??
      call.transcript_text,
    roomNoHint: call.room_no_hint,
  });
}

export function parseSecondaryTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x));
}

export function hasUrgentTag(tags: string[]): boolean {
  return tags.includes("urgent_issue");
}

export function pickDescription(
  call: CallRow,
  analysis: AnalysisResult,
): string {
  return analysis.summary?.trim() || call.transcript_text?.trim() || "";
}

export function buildMaintenanceCase(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): {
  room_no: string | null;
  case_type: string;
  issue_type: string | null;
  title: string;
  description: string;
  severity: "medium" | "high";
  status: "open";
  channel_type: "call";
  source_confidence: number;
} {
  const room = roomNoForWorkflow(call, entity, analysis);
  const issue = entity?.issue_type?.trim() || null;
  const roomLabel = room ?? "객실미상";
  const issueLabel = issue ?? "유지보수 이슈";
  const title = `${roomLabel} ${issueLabel}`.trim();
  const tags = parseSecondaryTags(analysis.secondary_tags);
  const severity = hasUrgentTag(tags)
    ? OPERATION_CASE_SEVERITY.high
    : OPERATION_CASE_SEVERITY.medium;
  return {
    room_no: room,
    case_type: "maintenance",
    issue_type: issue,
    title,
    description: pickDescription(call, analysis),
    severity,
    status: OPERATION_CASE_STATUS.open,
    channel_type: OPERATION_CASE_CHANNEL_TYPE.call,
    source_confidence: analysis.confidence || 0.5,
  };
}

/** complaint → operation_cases (`case_type = complaint`), `call_id` upsert로 maintenance와 동일 테이블·중복 방지 */
export function buildComplaintCase(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): {
  room_no: string | null;
  case_type: string;
  issue_type: string | null;
  title: string;
  description: string;
  severity: "medium" | "high";
  status: "open";
  channel_type: "call";
  source_confidence: number;
} {
  const room = roomNoForWorkflow(call, entity, analysis);
  const title = room
    ? `${room.trim()} 컴플레인`
    : "객실미상 컴플레인";
  const issueType = entity?.issue_type?.trim() || "complaint";
  const tags = parseSecondaryTags(analysis.secondary_tags);
  const severity = hasUrgentTag(tags)
    ? OPERATION_CASE_SEVERITY.high
    : OPERATION_CASE_SEVERITY.medium;
  const description = pickDescription(call, analysis);
  return {
    room_no: room,
    case_type: "complaint",
    issue_type: issueType,
    title,
    description,
    severity,
    status: OPERATION_CASE_STATUS.open,
    channel_type: OPERATION_CASE_CHANNEL_TYPE.call,
    source_confidence: analysis.confidence || 0.5,
  };
}

export function buildServiceRequestRow(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): {
  room_no: string | null;
  request_type: string;
  item_requested: string | null;
  quantity: number | null;
  unit: string | null;
  title: string;
  description: string;
  status: "open";
} {
  const room = roomNoForWorkflow(call, entity, analysis);
  const item = entity?.item_requested?.trim() || null;
  const roomLabel = room ?? "객실미상";
  const itemLabel = item ?? "비품 요청";
  return {
    room_no: room,
    request_type: "item_delivery",
    item_requested: entity?.item_requested ?? null,
    quantity: entity?.quantity ?? null,
    unit: entity?.unit ?? null,
    title: `${roomLabel} ${itemLabel}`.trim(),
    description: pickDescription(call, analysis),
    status: "open",
  };
}

export function buildPaymentCase(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): {
  room_no: string | null;
  case_type: string;
  issue_type: string | null;
  title: string;
  description: string;
  severity: "medium";
  status: "open";
  channel_type: "call";
  source_confidence: number;
} {
  const room = roomNoForWorkflow(call, entity, analysis);
  const roomLabel = room ?? "객실미상";
  const amt = entity?.amount ?? analysis.entities?.amount;
  const method = entity?.payment_method ?? analysis.entities?.payment_method;
  const bits = [method, amt != null ? `${amt}` : null].filter(Boolean).join(" · ");
  const title = bits ? `${roomLabel} 결제·입금 (${bits})` : `${roomLabel} 결제·입금 문의`;
  return {
    room_no: room,
    case_type: "payment",
    issue_type: "payment",
    title,
    description: pickDescription(call, analysis),
    severity: OPERATION_CASE_SEVERITY.medium,
    status: OPERATION_CASE_STATUS.open,
    channel_type: OPERATION_CASE_CHANNEL_TYPE.call,
    source_confidence: analysis.confidence || 0.5,
  };
}

export function buildReservationLeadRow(
  call: CallRow,
  entity: CallEntityRow | null,
  analysis: AnalysisResult,
): {
  phone_number: string | null;
  normalized_phone: string | null;
  lead_type: string;
  guest_name: string | null;
  room_no: string | null;
  arrival_eta: string | null;
  occupancy_count: number | null;
  quoted_price: number | null;
  title: string;
  description: string;
  status: "new";
} {
  const summary = analysis.summary?.trim() || "";
  const shortTitle =
    summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;
  const title =
    shortTitle || `${analysis.primary_intent} lead`;
  return {
    phone_number: call.phone_number,
    normalized_phone: call.normalized_phone,
    lead_type: analysis.primary_intent,
    guest_name: entity?.guest_name ?? null,
    room_no: roomNoForWorkflow(call, entity, analysis),
    arrival_eta: entity?.arrival_eta ?? null,
    occupancy_count: entity?.occupancy_count ?? null,
    quoted_price: entity?.quoted_price ?? null,
    title,
    description: pickDescription(call, analysis),
    status: "new",
  };
}

export function shouldCreateWorkflowForIntent(
  intent: string,
): "operation_case" | "service_request" | "reservation_lead" | null {
  switch (intent) {
    case "maintenance":
    case "complaint":
    case "payment":
      return "operation_case";
    case "service_request":
      return "service_request";
    case "reservation_inquiry":
    case "rate_inquiry":
    case "extension_request":
    case "quotation_intent":
      return "reservation_lead";
    // 신규 taxonomy: 자동 라우팅 보류
    case "checkin_checkout":
    case "cancel_request":
    case "refund_request":
    case "parking":
    case "manual_review_required":
    case "other":
    default:
      return null;
  }
}

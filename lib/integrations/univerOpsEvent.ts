/**
 * univer-ops로 운영 이벤트를 push한다.
 * 실패해도 조용히 무시 — 메인 파이프라인을 블로킹하지 않는다.
 */
import { getServiceSupabase } from "@/lib/supabase/server";

const UNIVER_OPS_URL = process.env.UNIVER_OPS_URL?.trim() ?? "";
const UNIVER_OPS_SECRET = process.env.UNIVER_OPS_SECRET?.trim() ?? "";

type EventType = "maintenance" | "complaint" | "reservation_lead" | "service_request";
type Priority = "low" | "normal" | "high" | "urgent";

interface OpsEventPayload {
  event_version: 1;
  event_type: EventType;
  source_type: "call";
  source_event_id: string;
  room: string | null;
  phone: string | null;
  summary: string;
  priority: Priority;
  occurred_at: string | null;
  context: {
    repeat_count: number;
    recent_resolutions: string[];
    prior_lead_count?: number;
    last_lead_summary?: string;
  };
}

async function buildContext(roomNo: string | null, caseType: string, currentCallId: string) {
  if (!roomNo) return { repeat_count: 1, recent_resolutions: [] }

  const supabase = getServiceSupabase();

  const [countResult, recentResult] = await Promise.all([
    // 같은 호실 + 같은 케이스 유형 (이번 통화 제외)
    supabase
      .from("operation_cases")
      .select("id", { count: "exact", head: true })
      .eq("room_no", roomNo)
      .eq("case_type", caseType)
      .neq("call_id", currentCallId),

    // 같은 호실의 최근 완료 케이스
    supabase
      .from("operation_cases")
      .select("title")
      .eq("room_no", roomNo)
      .eq("case_type", caseType)
      .in("status", ["resolved", "closed"])
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);

  const repeat_count = (countResult.count ?? 0) + 1;
  const recent_resolutions = (recentResult.data ?? []).map((r) => r.title).filter(Boolean) as string[];

  return { repeat_count, recent_resolutions };
}

function leadStatusLabel(status: string): string {
  if (status === "converted") return "예약 확정";
  if (status === "contacted") return "연락됨";
  if (status === "lost") return "취소";
  return "확정 여부 미기입";
}

async function buildLeadContext(normalizedPhone: string | null, currentCallId: string) {
  if (!normalizedPhone) return {};

  const supabase = getServiceSupabase();

  const [countResult, lastResult] = await Promise.all([
    supabase
      .from("reservation_leads")
      .select("id", { count: "exact", head: true })
      .eq("normalized_phone", normalizedPhone)
      .neq("call_id", currentCallId),

    supabase
      .from("reservation_leads")
      .select("title, status")
      .eq("normalized_phone", normalizedPhone)
      .neq("call_id", currentCallId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const prior_lead_count = countResult.count ?? 0;
  if (prior_lead_count === 0) return {};

  const last = lastResult.data;
  const last_lead_summary = last
    ? `${last.title} · ${leadStatusLabel(last.status)}`
    : undefined;

  return { prior_lead_count, last_lead_summary };
}

function severityToPriority(severity: string | null | undefined): Priority {
  if (severity === "high") return "high";
  if (severity === "low") return "low";
  return "normal";
}

export async function pushOperationCase(args: {
  callId: string;
  caseType: string;
  roomNo: string | null;
  phoneNumber: string | null;
  title: string;
  severity: string | null;
  occurredAt: string | null;
}): Promise<void> {
  if (!UNIVER_OPS_URL || !UNIVER_OPS_SECRET) return;

  const eventType: EventType =
    args.caseType === "complaint" ? "complaint" : "maintenance";

  try {
    const context = await buildContext(args.roomNo, args.caseType, args.callId);

    const payload: OpsEventPayload = {
      event_version: 1,
      event_type: eventType,
      source_type: "call",
      source_event_id: args.callId,
      room: args.roomNo,
      phone: args.phoneNumber,
      summary: args.title,
      priority: severityToPriority(args.severity),
      occurred_at: args.occurredAt,
      context,
    };

    console.log('[UNIVER_OPS_PUSH_PRE_SEND]', {
      callId: args.callId,
      summary: args.title,
      charCodes: Array.from(args.title).slice(0, 20).map(c => c.charCodeAt(0)),
      jsonSnippet: JSON.stringify({ summary: args.title }).slice(0, 80),
    });

    await fetch(`${UNIVER_OPS_URL}/api/ops-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${UNIVER_OPS_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    // push 실패는 파이프라인에 영향 없음
    console.warn("[univer-ops push] failed (ignored)", args.callId, e instanceof Error ? e.message : e);
  }
}

export async function pushReservationLead(args: {
  callId: string;
  normalizedPhone: string | null;
  phoneNumber: string | null;
  roomNo: string | null;
  title: string;
  occurredAt: string | null;
}): Promise<void> {
  if (!UNIVER_OPS_URL || !UNIVER_OPS_SECRET) return;

  try {
    const leadContext = await buildLeadContext(args.normalizedPhone, args.callId);

    const payload: OpsEventPayload = {
      event_version: 1,
      event_type: "reservation_lead",
      source_type: "call",
      source_event_id: args.callId,
      room: args.roomNo,
      phone: args.phoneNumber,
      summary: args.title,
      priority: "normal",
      occurred_at: args.occurredAt,
      context: { repeat_count: 1, recent_resolutions: [], ...leadContext },
    };

    console.log('[UNIVER_OPS_PUSH_PRE_SEND]', {
      callId: args.callId,
      summary: args.title,
      charCodes: Array.from(args.title).slice(0, 20).map(c => c.charCodeAt(0)),
      jsonSnippet: JSON.stringify({ summary: args.title }).slice(0, 80),
    });

    await fetch(`${UNIVER_OPS_URL}/api/ops-events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${UNIVER_OPS_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn("[univer-ops push] failed (ignored)", args.callId, e instanceof Error ? e.message : e);
  }
}

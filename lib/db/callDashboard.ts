import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallRow, HandlingStatus } from "@/lib/types/database";
import { normalizePhone } from "@/lib/utils/phone";

const MAX_SCAN = 2000;

export type WorkflowTypeCol =
  | "operation_case"
  | "service_request"
  | "reservation_lead"
  | "none";

export interface LastActivitySnippet {
  event_type: string;
  actor: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CallListRow {
  id: string;
  created_at: string;
  phone_number: string | null;
  primary_intent: string | null;
  manual_classification: string | null;
  summary: string | null;
  room_no: string | null;
  workflow_type: WorkflowTypeCol;
  severity: string | null;
  error_stage: string | null;
  stt_status: string | null;
  analysis_status: string | null;
  /** calls.analysis_persist_level */
  analysis_persist_level: string | null;
  handling_status: HandlingStatus | null;
  assignee: string | null;
  next_action: string | null;
  next_action_at: string | null;
  last_activity: LastActivitySnippet | null;
}

export interface CallsDashboardSummary {
  total: number;
  intentCounts: Record<string, number>;
  roomNoRatePercent: number | null;
  workflowCreatedRatePercent: number | null;
}

export interface ListCallsDashboardParams {
  intent?: string | null;
  phone?: string | null;
  room_hint?: string | null;
  room_no_present?: "yes" | "no" | null;
  workflow_created?: "yes" | "no" | null;
  has_error?: "yes" | "no" | null;
  handling_status?: HandlingStatus | null;
  pending_only?: boolean;
  assignee?: string | null;
  page?: number;
  pageSize?: number;
}

function inferErrorStage(c: CallRow): string | null {
  if (c.stt_status === "failed") return "stt";
  if (c.analysis_status === "failed") return "analysis";
  return null;
}

function hasAnyError(c: CallRow): boolean {
  if (c.stt_status === "failed") return true;
  if (c.analysis_status === "failed") return true;
  if (c.stt_error_message != null && String(c.stt_error_message).trim() !== "") {
    return true;
  }
  return false;
}

function pickWorkflowType(
  hasOc: boolean,
  hasSr: boolean,
  hasRl: boolean,
): WorkflowTypeCol {
  if (hasOc) return "operation_case";
  if (hasSr) return "service_request";
  if (hasRl) return "reservation_lead";
  return "none";
}

function computeSummary(rows: CallListRow[]): CallsDashboardSummary {
  const total = rows.length;
  const intentCounts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.primary_intent?.trim() || "—";
    intentCounts[k] = (intentCounts[k] ?? 0) + 1;
  }

  let withRoom = 0;
  let analyzed = 0;
  for (const r of rows) {
    if (
      r.analysis_status === "completed" ||
      r.analysis_status === "partial" ||
      r.analysis_status === "warning" ||
      r.analysis_status === "skipped"
    ) {
      analyzed++;
      if (r.room_no != null && String(r.room_no).trim() !== "") {
        withRoom++;
      }
    }
  }
  const roomNoRatePercent =
    analyzed > 0 ? Math.round((withRoom / analyzed) * 1000) / 10 : null;

  let wfCreated = 0;
  for (const r of rows) {
    if (r.workflow_type !== "none") wfCreated++;
  }
  const workflowCreatedRatePercent =
    total > 0 ? Math.round((wfCreated / total) * 1000) / 10 : null;

  return {
    total,
    intentCounts,
    roomNoRatePercent,
    workflowCreatedRatePercent,
  };
}

async function fetchEnrichment(callIds: string[]): Promise<{
  roomByCall: Map<string, string | null>;
  ocByCall: Map<string, { severity: string | null }>;
  srCalls: Set<string>;
  rlCalls: Set<string>;
}> {
  if (callIds.length === 0) {
    return {
      roomByCall: new Map(),
      ocByCall: new Map(),
      srCalls: new Set(),
      rlCalls: new Set(),
    };
  }

  const supabase = getServiceSupabase();
  const [entRes, ocRes, srRes, rlRes] = await Promise.all([
    supabase.from("call_entities").select("call_id, room_no").in("call_id", callIds),
    supabase
      .from("operation_cases")
      .select("call_id, severity")
      .in("call_id", callIds),
    supabase.from("service_requests").select("call_id").in("call_id", callIds),
    supabase.from("reservation_leads").select("call_id").in("call_id", callIds),
  ]);

  if (entRes.error) throw entRes.error;
  if (ocRes.error) throw ocRes.error;
  if (srRes.error) throw srRes.error;
  if (rlRes.error) throw rlRes.error;

  const roomByCall = new Map<string, string | null>();
  for (const row of entRes.data ?? []) {
    const id = String((row as { call_id: string }).call_id);
    if (!roomByCall.has(id)) {
      const rn = (row as { room_no: string | null }).room_no;
      roomByCall.set(id, rn?.trim() ? rn : null);
    }
  }

  const ocByCall = new Map<string, { severity: string | null }>();
  for (const row of ocRes.data ?? []) {
    const id = String((row as { call_id: string }).call_id);
    if (!ocByCall.has(id)) {
      ocByCall.set(id, {
        severity: (row as { severity: string | null }).severity ?? null,
      });
    }
  }

  const srCalls = new Set(
    (srRes.data ?? []).map((r) => String((r as { call_id: string }).call_id)),
  );
  const rlCalls = new Set(
    (rlRes.data ?? []).map((r) => String((r as { call_id: string }).call_id)),
  );

  return { roomByCall, ocByCall, srCalls, rlCalls };
}

function toListRow(
  c: CallRow,
  room_no: string | null,
  workflow_type: WorkflowTypeCol,
  severity: string | null,
): CallListRow {
  return {
    id: c.id,
    created_at: c.created_at,
    phone_number: c.phone_number,
    primary_intent: c.primary_intent,
    manual_classification: c.manual_classification ?? null,
    summary: c.summary,
    room_no,
    workflow_type,
    severity,
    error_stage: inferErrorStage(c),
    stt_status: c.stt_status,
    analysis_status: c.analysis_status,
    analysis_persist_level: c.analysis_persist_level ?? null,
    handling_status: (c.handling_status as HandlingStatus | null | undefined) ?? null,
    assignee: c.assignee ?? null,
    next_action: c.next_action ?? null,
    next_action_at: c.next_action_at ?? null,
    last_activity: null, // populated after batch fetch
  };
}

async function fetchLastActivities(
  callIds: string[],
): Promise<Map<string, LastActivitySnippet>> {
  if (callIds.length === 0) return new Map();
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("call_activity_logs")
    .select("call_id, event_type, actor, payload, created_at")
    .in("call_id", callIds)
    .order("created_at", { ascending: false });

  const map = new Map<string, LastActivitySnippet>();
  for (const row of data ?? []) {
    const cid = String((row as { call_id: string }).call_id);
    if (!map.has(cid)) {
      map.set(cid, {
        event_type: (row as { event_type: string }).event_type,
        actor: (row as { actor: string | null }).actor ?? null,
        payload: ((row as { payload: Record<string, unknown> }).payload) ?? {},
        created_at: (row as { created_at: string }).created_at,
      });
    }
  }
  return map;
}

/**
 * 통화 목록 대시보드: 최근 MAX_SCAN 건까지 스캔 후 메모리 필터·페이지네이션.
 */
export async function listCallsDashboard(
  params: ListCallsDashboardParams,
): Promise<{
  rows: CallListRow[];
  total: number;
  summary: CallsDashboardSummary;
}> {
  const supabase = getServiceSupabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

  let q = supabase
    .from("calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_SCAN);

  if (params.intent) {
    q = q.eq("primary_intent", params.intent);
  }
  const np = params.phone ? normalizePhone(params.phone) : null;
  if (np) {
    q = q.eq("normalized_phone", np);
  }
  if (params.room_hint) {
    const safe = params.room_hint.replace(/%/g, "\\%");
    q = q.ilike("room_no_hint", `%${safe}%`);
  }
  if (params.pending_only) {
    q = q.neq("handling_status", "done");
  } else if (params.handling_status) {
    q = q.eq("handling_status", params.handling_status);
  }
  if (params.assignee) {
    q = q.eq("assignee", params.assignee);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[calls] dashboard list error", error);
    throw error;
  }

  const calls = (data ?? []) as CallRow[];
  const ids = calls.map((c) => c.id);
  const { roomByCall, ocByCall, srCalls, rlCalls } = await fetchEnrichment(ids);

  const merged: CallListRow[] = [];

  for (const c of calls) {
    const room = roomByCall.get(c.id) ?? null;
    const hasOc = ocByCall.has(c.id);
    const hasSr = srCalls.has(c.id);
    const hasRl = rlCalls.has(c.id);
    const wf = pickWorkflowType(hasOc, hasSr, hasRl);
    const sev = hasOc ? (ocByCall.get(c.id)?.severity ?? null) : null;

    const row = toListRow(c, room, wf, sev);

    if (params.room_no_present === "yes") {
      if (row.room_no == null || String(row.room_no).trim() === "") continue;
    }
    if (params.room_no_present === "no") {
      if (row.room_no != null && String(row.room_no).trim() !== "") continue;
    }

    if (params.workflow_created === "yes" && row.workflow_type === "none") {
      continue;
    }
    if (params.workflow_created === "no" && row.workflow_type !== "none") {
      continue;
    }

    const err = hasAnyError(c);
    if (params.has_error === "yes" && !err) continue;
    if (params.has_error === "no" && err) continue;

    merged.push(row);
  }

  const summary = computeSummary(merged);
  const total = merged.length;
  const from = (page - 1) * pageSize;
  const pageRows = merged.slice(from, from + pageSize);

  // last activity — fetch only for the current page's rows to keep it cheap
  const activityMap = await fetchLastActivities(pageRows.map((r) => r.id));
  const rows = pageRows.map((r) => ({
    ...r,
    last_activity: activityMap.get(r.id) ?? null,
  }));

  return { rows, total, summary };
}

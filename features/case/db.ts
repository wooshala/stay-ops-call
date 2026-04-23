import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallEntityRow, CallRow } from "@/lib/types/database";
import type { CaseEventRow, ReservationCaseRow } from "@/features/case/types";

export async function getLatestCallEntity(callId: string): Promise<Pick<CallEntityRow, "checkin_date" | "occupancy_count"> | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("call_entities")
    .select("checkin_date,occupancy_count,created_at")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
  if (!row) return null;
  return { checkin_date: row.checkin_date ?? null, occupancy_count: row.occupancy_count ?? null };
}

export async function listCompletedCalls(limit = 500): Promise<CallRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("analysis_status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CallRow[]) ?? [];
}

export async function getCallById(callId: string): Promise<CallRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("calls").select("*").eq("id", callId).maybeSingle();
  if (error) throw error;
  return (data as CallRow | null) ?? null;
}

export async function findCaseByCallId(callId: string): Promise<ReservationCaseRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("reservation_cases")
    .select("*")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ReservationCaseRow | null) ?? null;
}

export async function getCaseById(caseId: string): Promise<ReservationCaseRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("reservation_cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw error;
  return (data as ReservationCaseRow | null) ?? null;
}

export async function insertReservationCase(row: Partial<ReservationCaseRow>): Promise<ReservationCaseRow> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("reservation_cases").insert(row).select("*").single();
  if (error) throw error;
  return data as ReservationCaseRow;
}

export async function insertCaseEvent(input: { case_id: string; type: string; message: string }): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("case_events").insert({
    case_id: input.case_id,
    type: input.type,
    message: input.message,
  });
  if (error) throw error;
}

export async function listCaseEvents(caseId: string): Promise<CaseEventRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CaseEventRow[]) ?? [];
}

export async function listCases(filters: { state?: string; owner?: string } = {}): Promise<ReservationCaseRow[]> {
  const supabase = getServiceSupabase();
  let q = supabase.from("reservation_cases").select("*").order("created_at", { ascending: false });
  if (filters.state) q = q.eq("state", filters.state);
  if (filters.owner) q = q.eq("current_owner", filters.owner);
  const { data, error } = await q;
  if (error) throw error;
  return (data as ReservationCaseRow[]) ?? [];
}

export async function updateCase(caseId: string, patch: Record<string, unknown>): Promise<ReservationCaseRow> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("reservation_cases").update(patch).eq("id", caseId).select("*").single();
  if (error) throw error;
  return data as ReservationCaseRow;
}


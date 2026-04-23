import { getServiceSupabase } from "@/lib/supabase/server";
import { CallActivityLogRow, CallRow, HandlingStatus } from "@/lib/types/database";

export interface UpdateCallHandlingInput {
  handling_status?: HandlingStatus;
  manual_classification?: string | null;
  assignee?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  /** 외부에서 직접 전달하지 말 것 — handling_status 변화에 따라 자동 설정됨 */
  handled_at?: string | null;
}

export async function updateCallHandling(
  id: string,
  patch: UpdateCallHandlingInput,
  actor?: string,
): Promise<CallRow> {
  const supabase = getServiceSupabase();

  const { data: before } = await supabase
    .from("calls")
    .select("handling_status, assignee, next_action, next_action_at")
    .eq("id", id)
    .single();

  // handled_at 자동 관리: done 전환 시 now(), done에서 벗어날 때 null
  const appliedPatch: UpdateCallHandlingInput & { handled_at?: string | null } = { ...patch };
  if (patch.handling_status !== undefined) {
    if (patch.handling_status === "done") {
      appliedPatch.handled_at = new Date().toISOString();
    } else if (before?.handling_status === "done") {
      appliedPatch.handled_at = null;
    }
  }

  const { data, error } = await supabase
    .from("calls")
    .update(appliedPatch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  const logs: Array<{ call_id: string; event_type: string; actor: string | null; payload: object }> = [];

  if (patch.handling_status !== undefined && patch.handling_status !== before?.handling_status) {
    logs.push({
      call_id: id,
      event_type: "status_changed",
      actor: actor ?? null,
      payload: { from: before?.handling_status ?? "new", to: patch.handling_status },
    });
  }
  if (patch.assignee !== undefined && patch.assignee !== before?.assignee) {
    logs.push({
      call_id: id,
      event_type: "assignee_changed",
      actor: actor ?? null,
      payload: { from: before?.assignee ?? null, to: patch.assignee },
    });
  }
  if (
    patch.next_action !== undefined &&
    (patch.next_action !== before?.next_action || patch.next_action_at !== before?.next_action_at)
  ) {
    logs.push({
      call_id: id,
      event_type: "next_action_set",
      actor: actor ?? null,
      payload: { next_action: patch.next_action, next_action_at: patch.next_action_at ?? null },
    });
  }

  if (logs.length > 0) {
    await supabase.from("call_activity_logs").insert(logs);
  }

  return data as CallRow;
}

export async function addCallNote(
  callId: string,
  note: string,
  actor?: string,
): Promise<CallActivityLogRow> {
  const supabase = getServiceSupabase();

  // activity log (이력) + calls.note (현재 대표 메모 스냅샷) 동시 갱신
  const [logResult] = await Promise.all([
    supabase
      .from("call_activity_logs")
      .insert({ call_id: callId, event_type: "note_added", actor: actor ?? null, payload: { note } })
      .select("*")
      .single(),
    supabase
      .from("calls")
      .update({ note })
      .eq("id", callId),
  ]);

  if (logResult.error) throw logResult.error;
  return logResult.data as CallActivityLogRow;
}

export async function getCallActivityLogs(callId: string): Promise<CallActivityLogRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("call_activity_logs")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CallActivityLogRow[];
}

import { extractReservationSignals } from "@/features/case/lib/extractFromCall";
import { isReservationIntent } from "@/features/case/lib/intent";
import { nowPlusHours } from "@/features/case/lib/dates";
import { getDefaultSlaHours } from "@/features/case/lib/sla";
import { findCaseByCallId, getLatestCallEntity, insertCaseEvent, insertReservationCase, listCompletedCalls } from "@/features/case/db";
import { caseEventMessage } from "@/features/case/lib/eventMessages";
import type { CallRow } from "@/lib/types/database";

export type ReconcileResult = {
  scanned: number;
  created: number;
  skipped_existing: number;
  skipped_not_reservation: number;
  skipped_no_checkin_date: number;
  errors: Array<{ call_id: string; error: string }>;
};

export async function reconcileCasesFromCalls(opts: { limit?: number } = {}): Promise<ReconcileResult> {
  const limit = opts.limit ?? 500;
  const calls = await listCompletedCalls(limit);

  const result: ReconcileResult = {
    scanned: calls.length,
    created: 0,
    skipped_existing: 0,
    skipped_not_reservation: 0,
    skipped_no_checkin_date: 0,
    errors: [],
  };

  for (const call of calls) {
    try {
      await maybeCreateCaseFromCall(call, result);
    } catch (e) {
      result.errors.push({ call_id: call.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}

async function maybeCreateCaseFromCall(call: CallRow, acc: ReconcileResult): Promise<void> {
  const existing = await findCaseByCallId(call.id);
  if (existing) {
    acc.skipped_existing += 1;
    return;
  }

  if (!isReservationIntent(call.primary_intent)) {
    acc.skipped_not_reservation += 1;
    return;
  }

  const latestEntity = await getLatestCallEntity(call.id);
  const signals = extractReservationSignals({ call, latestEntity });

  if (!signals.checkin_date) {
    acc.skipped_no_checkin_date += 1;
    return;
  }

  const state = "inquiry";
  const dueAt = nowPlusHours(getDefaultSlaHours(state));
  const owner = (typeof (call as any).assigned_user === "string" && (call as any).assigned_user.trim()) ? (call as any).assigned_user.trim() : "unassigned";

  const created = await insertReservationCase({
    call_id: call.id,
    phone_number: signals.phone_number,
    checkin_date: signals.checkin_date,
    stay_type: signals.stay_type,
    room_type: signals.room_type,
    people_count: signals.people_count,
    state,
    current_owner: owner,
    next_action: "고객 재확인",
    due_at: dueAt,
    risk_level: "normal",
  });

  await insertCaseEvent({
    case_id: created.id,
    type: "created_from_call",
    message: caseEventMessage({ type: "created_from_call" }),
  });

  acc.created += 1;
}


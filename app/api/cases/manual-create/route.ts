import { getCallById, findCaseByCallId, getLatestCallEntity, insertCaseEvent, insertReservationCase } from "@/features/case/db";
import { extractReservationSignals } from "@/features/case/lib/extractFromCall";
import { isReservationIntent } from "@/features/case/lib/intent";
import { nowPlusHours, toIsoDateOnly } from "@/features/case/lib/dates";
import { getDefaultSlaHours } from "@/features/case/lib/sla";
import { caseEventMessage } from "@/features/case/lib/eventMessages";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { call_id?: string; checkin_date?: string };
  const callId = (body.call_id ?? "").trim();
  const dateInput = (body.checkin_date ?? "").trim();
  const iso = toIsoDateOnly(dateInput);

  if (!callId) return Response.json({ error: "missing_call_id" }, { status: 400 });
  if (!iso) return Response.json({ error: "missing_checkin_date" }, { status: 400 });

  const call = await getCallById(callId);
  if (!call) return Response.json({ error: "call_not_found" }, { status: 404 });
  if (call.analysis_status !== "completed") {
    return Response.json({ error: "call_not_completed" }, { status: 400 });
  }
  if (!isReservationIntent(call.primary_intent)) {
    return Response.json({ error: "not_reservation_intent" }, { status: 400 });
  }

  const existing = await findCaseByCallId(callId);
  if (existing) return Response.json({ ok: true, row: existing, already: true });

  const latestEntity = await getLatestCallEntity(callId);
  const signals = extractReservationSignals({ call, latestEntity });

  const state = "inquiry";
  const dueAt = nowPlusHours(getDefaultSlaHours(state));

  const row = await insertReservationCase({
    call_id: callId,
    phone_number: signals.phone_number,
    checkin_date: iso,
    stay_type: signals.stay_type,
    room_type: signals.room_type,
    people_count: signals.people_count,
    state,
    current_owner: "unassigned",
    next_action: "고객 재확인",
    due_at: dueAt,
    risk_level: "normal",
  });

  await insertCaseEvent({
    case_id: row.id,
    type: "manual_created_from_call",
    message: caseEventMessage({ type: "manual_created_from_call", checkin_date: iso }),
  });

  return Response.json({ ok: true, row });
}


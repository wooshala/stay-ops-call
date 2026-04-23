import { getDefaultSlaHours } from "@/features/case/lib/sla";
import { nowPlusHours } from "@/features/case/lib/dates";
import { insertCaseEvent, updateCase } from "@/features/case/db";
import { caseEventMessage } from "@/features/case/lib/eventMessages";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?:
      | "confirm"
      | "close_lost"
      | "assign"
      | "update"
      | "mark_pms_registered"
      | "mark_checkin_time_confirmed"
      | "mark_room_confirmed";
    owner?: string;
    patch?: Record<string, unknown>;
  };

  const action = body.action;
  if (!action) {
    return Response.json({ error: "missing_action" }, { status: 400 });
  }

  if (action === "assign") {
    const owner = (body.owner ?? "").trim();
    const next = await updateCase(id, { current_owner: owner || "unassigned", updated_at: new Date().toISOString() });
    await insertCaseEvent({ case_id: id, type: "assign", message: caseEventMessage({ type: "assign", owner: owner || "unassigned" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "confirm") {
    const dueAt = nowPlusHours(getDefaultSlaHours("confirmed"));
    const next = await updateCase(id, {
      state: "confirmed",
      due_at: dueAt,
      updated_at: new Date().toISOString(),
    });
    await insertCaseEvent({ case_id: id, type: "state_confirmed", message: caseEventMessage({ type: "state_confirmed" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "close_lost") {
    const next = await updateCase(id, {
      state: "closed_lost",
      updated_at: new Date().toISOString(),
    });
    await insertCaseEvent({ case_id: id, type: "state_closed_lost", message: caseEventMessage({ type: "state_closed_lost" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "mark_pms_registered") {
    const next = await updateCase(id, { is_pms_registered: true, updated_at: new Date().toISOString() });
    await insertCaseEvent({ case_id: id, type: "flag_pms", message: caseEventMessage({ type: "flag_pms" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "mark_checkin_time_confirmed") {
    const next = await updateCase(id, { is_checkin_time_confirmed: true, updated_at: new Date().toISOString() });
    await insertCaseEvent({ case_id: id, type: "flag_checkin_time", message: caseEventMessage({ type: "flag_checkin_time" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "mark_room_confirmed") {
    const next = await updateCase(id, { is_room_confirmed: true, updated_at: new Date().toISOString() });
    await insertCaseEvent({ case_id: id, type: "flag_room", message: caseEventMessage({ type: "flag_room" }) });
    return Response.json({ ok: true, row: next });
  }

  if (action === "update") {
    const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
    const next = await updateCase(id, { ...patch, updated_at: new Date().toISOString() });
    await insertCaseEvent({
      case_id: id,
      type: "fields_updated",
      message: caseEventMessage({ type: "fields_updated", fields: patch }),
    });
    return Response.json({ ok: true, row: next });
  }

  return Response.json({ error: "unsupported_action" }, { status: 400 });
}


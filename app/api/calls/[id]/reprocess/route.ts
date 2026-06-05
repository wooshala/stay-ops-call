import { assertReprocessAuthorized } from "@/lib/auth/reprocessApi";
import { getCallById } from "@/lib/db/calls";
import { processUploadedCallForStt } from "@/lib/pipeline/processUploadedCallForStt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/calls/:id/reprocess — full STT → analysis → pending_events pipeline */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = assertReprocessAuthorized(request);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const call = await getCallById(id);
    if (!call) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    console.log("[CALL_REPROCESS_START]", { callId: id });

    const result = await processUploadedCallForStt({
      callId: id,
      phone: call.phone_number,
      room: call.room_no_hint,
    });

    const updated = await getCallById(id);

    console.log("[CALL_REPROCESS_DONE]", {
      callId: id,
      stage: result.stage,
      ok: result.ok,
    });

    return Response.json({
      ok: result.ok,
      stage: result.stage,
      call_id: id,
      error: result.error ?? null,
      pending_event_patched: result.pendingEventPatched ?? null,
      call: updated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reprocess failed";
    console.error("[CALL_REPROCESS_FAIL]", { callId: id, error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

import { approveReservationDraft } from "@/lib/db/reservationDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { reviewed_by?: string };
    const reviewedBy =
      typeof body.reviewed_by === "string" && body.reviewed_by.trim()
        ? body.reviewed_by.trim()
        : null;
    const row = await approveReservationDraft(id, reviewedBy);
    return Response.json(row);
  } catch (e) {
    console.error("POST /api/approvals/[id]/approve failed:", e);
    const msg = e instanceof Error ? e.message : "failed";
    if (msg.includes("not found") || msg.includes("not pending")) {
      return Response.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("concurrent")) {
      return Response.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Google Sheets") || msg.includes("GOOGLE_SHEETS")) {
      return Response.json({ error: msg }, { status: 503 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

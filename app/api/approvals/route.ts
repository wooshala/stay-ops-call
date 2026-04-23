import { listReservationDrafts, type ReservationDraftStatus } from "@/lib/db/reservationDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const raw = sp.get("status");
    let status: ReservationDraftStatus | undefined;
    if (raw === "all") status = undefined;
    else if (raw) status = raw as ReservationDraftStatus;
    else status = "pending";
    const limit = sp.get("limit") ? Number(sp.get("limit")) : 100;
    const drafts = await listReservationDrafts({
      status,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return Response.json({ drafts });
  } catch (e) {
    console.error("GET /api/approvals failed:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

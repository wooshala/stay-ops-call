import { assertInternalApiAuthorized } from "@/lib/auth/internalApi";
import { runBackfillReservationDrafts } from "@/lib/db/reservationDrafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = assertInternalApiAuthorized(
    request,
    "POST /api/internal/backfill-reservation-drafts",
  );
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      days?: number;
      limit?: number;
    };
    const days =
      typeof body.days === "number" && Number.isFinite(body.days)
        ? Math.min(365, Math.max(1, body.days))
        : 14;
    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(2000, Math.max(1, body.limit))
        : 500;

    const result = await runBackfillReservationDrafts({ days, limit });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

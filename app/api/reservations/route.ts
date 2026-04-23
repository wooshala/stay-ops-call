import { createReservation, listReservations } from "@/lib/db/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams: sp } = new URL(request.url);
    const rawStatuses = sp.get("statuses");
    const result = await listReservations({
      date:            sp.get("date"),
      date_from:       sp.get("date_from"),
      date_to:         sp.get("date_to"),
      status:          sp.get("status"),
      statuses:        rawStatuses ? rawStatuses.split(",").filter(Boolean) : null,
      pms_unconfirmed: sp.get("pms_unconfirmed") === "1",
      unconfirmed:     sp.get("unconfirmed") === "1",
      phone:           sp.get("phone"),
      only_danger:     sp.get("only_danger") === "1",
      q:               sp.get("q"),
      page:            sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize:        sp.get("page_size") ? Number(sp.get("page_size")) : 100,
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.check_in_date || !body.status) {
      return Response.json({ error: "check_in_date, status 필수" }, { status: 400 });
    }
    const row = await createReservation(body);
    return Response.json(row, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

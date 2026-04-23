import { getPhoneHistory } from "@/lib/db/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    if (!phone) return Response.json({ error: "phone 필수" }, { status: 400 });
    const result = await getPhoneHistory(phone);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

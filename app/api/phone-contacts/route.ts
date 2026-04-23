import { listPhoneContacts } from "@/lib/db/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const { rows, total } = await listPhoneContacts({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });

    return Response.json({ contacts: rows, total });
  } catch (e) {
    console.error("[GET /api/phone-contacts]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "List failed" },
      { status: 500 },
    );
  }
}

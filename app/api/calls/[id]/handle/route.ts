import { updateCallHandling } from "@/lib/db/callOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, ...patch } = body;
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "변경할 필드가 없습니다" }, { status: 400 });
    }
    const row = await updateCallHandling(id, patch, actor);
    return Response.json(row);
  } catch (e) {
    console.error("PATCH /api/calls/[id]/handle failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

import { addCallNote, getCallActivityLogs } from "@/lib/db/callOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const logs = await getCallActivityLogs(id);
    return Response.json(logs);
  } catch (e) {
    console.error("GET /api/calls/[id]/activity failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.note?.trim()) {
      return Response.json({ error: "note 필수" }, { status: 400 });
    }
    const log = await addCallNote(id, body.note.trim(), body.actor);
    return Response.json(log, { status: 201 });
  } catch (e) {
    console.error("POST /api/calls/[id]/activity failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

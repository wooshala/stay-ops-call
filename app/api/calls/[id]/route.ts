import { cleanTranscript } from "@/lib/analysis/cleanTranscript";
import {
  getCallDetailBundle,
  tryUpdateCallTranscripts,
} from "@/lib/db/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const bundle = await getCallDetailBundle(id);
    if (!bundle) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(bundle);
  } catch (e) {
    console.error("[GET /api/calls/[id]]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Load failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      transcript_text?: string | null;
      transcript_cleaned?: string | null;
      regenerate_cleaned?: boolean;
    };

    let transcript_text = body.transcript_text;
    let transcript_cleaned = body.transcript_cleaned;

    if (body.regenerate_cleaned === true && typeof transcript_text === "string") {
      transcript_cleaned = cleanTranscript(transcript_text);
    }

    const patch: {
      transcript_text?: string | null;
      transcript_cleaned?: string | null;
    } = {};
    if (transcript_text !== undefined) patch.transcript_text = transcript_text;
    if (transcript_cleaned !== undefined) patch.transcript_cleaned = transcript_cleaned;

    const hasTranscriptPatch = Object.keys(patch).length > 0;
    if (!hasTranscriptPatch) {
      return Response.json({ error: "No updatable fields" }, { status: 400 });
    }

    if (hasTranscriptPatch) {
      const ok = await tryUpdateCallTranscripts(id, patch);
      if (!ok) {
        return Response.json({ error: "Transcript update failed" }, { status: 500 });
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/calls/[id]]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 },
    );
  }
}

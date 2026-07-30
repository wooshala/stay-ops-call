import { cleanTranscript } from "@/lib/analysis/cleanTranscript";
import {
  getCallDetailBundle,
  tryUpdateCallTranscripts,
} from "@/lib/db/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * calls.id 는 uuid 컬럼(001_create_calls.sql)이다. 비-uuid 를 그대로 조회하면
 * Postgres 22P02 가 throw 되어 500 "Load failed" 로 위장된다.
 *
 * 특히 `/api/calls/history` 같은 정적 하위 경로가 배포에서 누락되면 이 동적 라우트가
 * id="history" 로 흡수해 500 을 낸다(CALL-DASH-DIAG-2 근본원인). 배포 누락이 500 이
 * 아니라 404 로 드러나도록 DB 조회 전에 형식을 검사한다.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      console.warn("[calls] non-uuid id rejected", {
        route: "/api/calls/[id]",
        id,
      });
      return Response.json({ error: "Not found" }, { status: 404 });
    }
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

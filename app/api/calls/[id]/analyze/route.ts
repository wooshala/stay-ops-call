import { assertInternalApiAuthorized } from "@/lib/auth/internalApi";
import { executeCallAnalyzePipeline } from "@/lib/api/callAnalyzePipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEBUG_ANALYZE = process.env.DEBUG_ANALYZE === "1";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = assertInternalApiAuthorized(request, "POST /api/calls/[id]/analyze");
  if (denied) {
    console.warn("[api][calls][analyze][auth] rejected");
    return denied;
  }

  const { id } = await context.params;

  try {
    if (DEBUG_ANALYZE) {
      console.log("=== ANALYZE DEBUG START ===", { callId: id });
      console.error("=== ANALYZE DEBUG START ===", { callId: id });
    }

    let useTranscriptCleaned = false;
    try {
      const body = (await request.json()) as {
        useTranscriptCleaned?: boolean;
      } | null;
      useTranscriptCleaned = body?.useTranscriptCleaned === true;
    } catch {
      /* empty body */
    }

    const result = await executeCallAnalyzePipeline(id, {
      useTranscriptCleaned,
    });

    if (!result.ok) {
      if (result.notFound) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      return Response.json({ error: result.error }, { status: 500 });
    }

    const { analysis, workflow: wf, bundle } = result;

    if (DEBUG_ANALYZE) {
      const s = analysis?.summary ?? "";
      const payload = {
        callId: id,
        summary: s ? `${s.slice(0, 120)}${s.length > 120 ? "…" : ""}` : "",
        summaryLength: s.length,
      };
      console.log("=== ANALYZE DEBUG parsed ===", payload);
      console.error("=== ANALYZE DEBUG parsed ===", payload);
    }

    if (DEBUG_ANALYZE) {
      const savedSummary = bundle?.call?.summary ?? null;
      const payload = {
        callId: id,
        summary: savedSummary
          ? `${savedSummary.slice(0, 120)}${savedSummary.length > 120 ? "…" : ""}`
          : null,
        summaryLength: savedSummary ? savedSummary.length : 0,
      };
      console.log("=== ANALYZE DEBUG saved ===", payload);
      console.error("=== ANALYZE DEBUG saved ===", payload);
    }

    return Response.json({
      analysis,
      workflow: wf.ok
        ? {
            createdType: wf.createdType,
            createdId: wf.createdId,
          }
        : { createdType: null, createdId: null, error: wf.error },
      bundle,
    });
  } catch (e) {
    console.error("[analyze] unexpected", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Analyze failed" },
      { status: 500 },
    );
  }
}

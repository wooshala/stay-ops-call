import { getCallById } from "@/lib/db/calls";
import { runSttForCall } from "@/lib/pipeline/runSttForCall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const call = await getCallById(id);
    if (!call) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (call.stt_status === "completed" && call.transcript_text) {
      return Response.json(
        {
          error:
            "STT already completed; transcript is preserved. Contact admin to re-run if needed.",
          call,
        },
        { status: 409 },
      );
    }

    let mockSampleIndex: number | undefined;
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        const body = await request.json();
        if (body && typeof body === "object" && "mockSampleIndex" in body) {
          const v = (body as { mockSampleIndex?: unknown }).mockSampleIndex;
          if (typeof v === "number" && Number.isFinite(v)) {
            mockSampleIndex = v;
          }
        }
      } catch {
        // ignore empty body
      }
    }

    const result = await runSttForCall(id, { mockSampleIndex });
    if (!result.ok) {
      return Response.json(
        { error: result.error, call: result.call },
        { status: 500 },
      );
    }

    const updated = await getCallById(id);
    return Response.json({ call: updated });
  } catch (e) {
    console.error("[process-stt]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "STT failed" },
      { status: 500 },
    );
  }
}

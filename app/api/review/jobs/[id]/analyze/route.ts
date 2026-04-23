import { listCallIdsForReviewJob, updateReviewJobStatus } from "@/lib/db/review";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await updateReviewJobStatus(id, "analyzing");
    const callIds = await listCallIdsForReviewJob(id);
    let ok = 0;
    let fail = 0;
    for (const callId of callIds) {
      try {
        const r = await runAnalysisForCall(callId);
        if (r.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    await updateReviewJobStatus(id, "analyzed");
    return Response.json({ ok: true, analyzed: ok, failed: fail, total: callIds.length });
  } catch (e) {
    console.error("[review analyze]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

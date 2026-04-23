import { importCallsFromBatchJob } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as { batch_job_id?: string };
    const batchJobId = body.batch_job_id?.trim();
    if (!batchJobId) {
      return Response.json({ error: "batch_job_id required" }, { status: 400 });
    }
    const imported = await importCallsFromBatchJob(id, batchJobId);
    return Response.json({ ok: true, imported });
  } catch (e) {
    console.error("[review import-batch]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

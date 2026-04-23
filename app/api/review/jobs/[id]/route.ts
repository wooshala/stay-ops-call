import { getReviewJob, getReviewJobStats } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const job = await getReviewJob(id);
    if (!job) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const stats = await getReviewJobStats(id);
    return Response.json({ job, stats });
  } catch (e) {
    console.error("[review/jobs/id GET]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

import { buildReviewClusters } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    let repsPerCluster: number | undefined;
    try {
      const body = (await request.json()) as { repsPerCluster?: number } | null;
      repsPerCluster = body?.repsPerCluster;
    } catch {
      /* empty */
    }
    const n = await buildReviewClusters(id, { repsPerCluster });
    return Response.json({ ok: true, clusters: n });
  } catch (e) {
    console.error("[review cluster]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

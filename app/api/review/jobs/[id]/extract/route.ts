import { extractReviewCandidates } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    let topN: number | undefined;
    try {
      const body = (await request.json()) as { topN?: number } | null;
      topN = body?.topN;
    } catch {
      /* empty */
    }
    const n = await extractReviewCandidates(id, { topN });
    return Response.json({ ok: true, candidates: n });
  } catch (e) {
    console.error("[review extract]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

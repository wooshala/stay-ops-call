import { listReviewPipeline, type ReviewPipelineStatus } from "@/lib/db/reviewPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseStatuses(raw: string | null): ReviewPipelineStatus[] {
  if (!raw) return ["raw", "needs_review", "verified"];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ReviewPipelineStatus[];
  const allowed: ReviewPipelineStatus[] = ["raw", "needs_review", "verified", "rejected"];
  const set = new Set(parts.filter((p) => allowed.includes(p)));
  return set.size ? [...set] : ["raw", "needs_review", "verified"];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statuses = parseStatuses(url.searchParams.get("status"));
    const includeRejected = url.searchParams.get("include_rejected") === "1";

    const { rows, counts } = await listReviewPipeline({
      statuses,
      includeRejected,
    });

    return Response.json({ rows, counts });
  } catch (e) {
    console.error("[review/pipeline]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

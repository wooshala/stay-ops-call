import { listRecentBatchJobs } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const batch_jobs = await listRecentBatchJobs(40);
    return Response.json({ batch_jobs });
  } catch (e) {
    console.error("[review/batch-jobs]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

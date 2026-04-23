import { createReviewJob, listReviewJobs } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await listReviewJobs(50);
    return Response.json({ jobs });
  } catch (e) {
    console.error("[review/jobs GET]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      source_batch_job_id?: string | null;
    };
    const title = body.title?.trim() || "검수 작업";
    const job = await createReviewJob({
      title,
      source_batch_job_id: body.source_batch_job_id ?? null,
    });
    return Response.json({ job });
  } catch (e) {
    console.error("[review/jobs POST]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

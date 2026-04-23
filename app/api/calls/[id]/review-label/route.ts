import {
  ensureReviewJobCall,
  findOrCreateReviewCandidateForCall,
  markCandidateStatus,
  upsertReviewLabel,
} from "@/lib/db/review";
import { getCallById } from "@/lib/db/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: callId } = await context.params;
    const call = await getCallById(callId);
    if (!call) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      review_job_id: string;
      final_call_type?: string | null;
      final_summary?: string | null;
      final_price_mentioned?: boolean | null;
      final_date_mentioned?: boolean | null;
      reviewer_note?: string | null;
    };

    if (!body.review_job_id) {
      return Response.json({ error: "review_job_id required" }, { status: 400 });
    }

    await ensureReviewJobCall(body.review_job_id, callId);
    const cand = await findOrCreateReviewCandidateForCall(
      body.review_job_id,
      callId,
    );

    await upsertReviewLabel({
      candidate_id: cand.id,
      final_call_type: body.final_call_type ?? null,
      final_summary: body.final_summary ?? null,
      final_price_mentioned: body.final_price_mentioned ?? null,
      final_date_mentioned: body.final_date_mentioned ?? null,
      reviewer_note: body.reviewer_note ?? null,
    });
    await markCandidateStatus(cand.id, "labeled");

    return Response.json({ ok: true, candidate_id: cand.id });
  } catch (e) {
    console.error("[POST /api/calls/[id]/review-label]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

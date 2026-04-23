import { getCallById } from "@/lib/db/calls";
import {
  getLabelForCandidate,
  getReviewJob,
  listReviewCandidatesWithCalls,
} from "@/lib/db/review";

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

    const cands = await listReviewCandidatesWithCalls(id, "");
    const rows = [];
    for (const c of cands) {
      const label = await getLabelForCandidate(c.id);
      const call = await getCallById(c.call_id);
      rows.push({
        candidate_id: c.id,
        call_id: c.call_id,
        review_priority_score: c.review_priority_score,
        cluster_key: c.cluster_key,
        predicted_call_type: c.predicted_call_type,
        intent_score: c.intent_score,
        is_fallback: c.is_fallback,
        review_status: c.review_status,
        reason_json: c.reason_json ?? null,
        is_representative: c.is_representative,
        call: call
          ? {
              phone_number: call.phone_number,
              created_at: call.created_at,
              primary_intent: call.primary_intent,
              summary: call.summary,
            }
          : null,
        label: label
          ? {
              final_call_type: label.final_call_type,
              final_summary: label.final_summary,
              final_price_mentioned: label.final_price_mentioned,
              final_date_mentioned: label.final_date_mentioned,
              reviewer_note: label.reviewer_note,
            }
          : null,
      });
    }

    const payload = {
      review_job: job,
      exported_at: new Date().toISOString(),
      rows,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="review-export-${id.slice(0, 8)}.json"`,
      },
    });
  } catch (e) {
    console.error("[review export]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

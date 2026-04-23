import {
  getLabelForCandidate,
  getReviewCandidateById,
  markCandidateStatus,
  upsertReviewLabel,
} from "@/lib/db/review";
import { cleanTranscript } from "@/lib/analysis/cleanTranscript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const row = await getReviewCandidateById(id);
    if (!row) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const label = await getLabelForCandidate(id);
    const cleaned =
      row.call.transcript_cleaned ??
      cleanTranscript(row.call.transcript_text ?? "");
    const r = row as typeof row & {
      original_intent?: string | null;
      original_summary?: string | null;
      original_confidence?: number | null;
      model_version?: string | null;
      prompt_version?: string | null;
      heuristic_version?: string | null;
      source?: string | null;
      reason_json?: unknown;
    };
    return Response.json({
      candidate: {
        id: r.id,
        review_job_id: r.review_job_id,
        call_id: r.call_id,
        review_priority_score: r.review_priority_score,
        cluster_key: r.cluster_key,
        predicted_call_type: r.predicted_call_type,
        intent_score: r.intent_score,
        is_fallback: r.is_fallback,
        review_status: r.review_status,
        is_representative: r.is_representative,
        reason_json: r.reason_json ?? null,
        // snapshot
        original_intent: r.original_intent ?? null,
        original_summary: r.original_summary ?? null,
        original_confidence: r.original_confidence ?? null,
        // versioning
        model_version: r.model_version ?? null,
        prompt_version: r.prompt_version ?? null,
        heuristic_version: r.heuristic_version ?? null,
        source: r.source ?? null,
      },
      call: r.call,
      transcript_cleaned: cleaned,
      label,
    });
  } catch (e) {
    console.error("[review candidate GET]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      action?: "save" | "skip";
      final_call_type?: string | null;
      final_summary?: string | null;
      final_price_mentioned?: boolean | null;
      final_date_mentioned?: boolean | null;
      final_requires_followup?: boolean | null;
      final_should_create_record?: boolean | null;
      reviewer_note?: string | null;
    };

    if (body.action === "skip") {
      await markCandidateStatus(id, "skipped");
      return Response.json({ ok: true });
    }

    await upsertReviewLabel({
      candidate_id: id,
      final_call_type: body.final_call_type ?? null,
      final_summary: body.final_summary ?? null,
      final_price_mentioned: body.final_price_mentioned ?? null,
      final_date_mentioned: body.final_date_mentioned ?? null,
      final_requires_followup: body.final_requires_followup ?? null,
      final_should_create_record: body.final_should_create_record ?? null,
      reviewer_type: "human",
      reviewer_note: body.reviewer_note ?? null,
    });
    await markCandidateStatus(id, "labeled");
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[review candidate PATCH]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

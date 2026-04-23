import { listReviewCandidatesWithCalls } from "@/lib/db/review";
import type { CandidateFilter } from "@/lib/db/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("filter") ?? "") as CandidateFilter;
    const rows = await listReviewCandidatesWithCalls(id, filter);
    return Response.json({
      candidates: rows.map((r) => ({
        ...r,
        call: {
          id: r.call.id,
          created_at: r.call.created_at,
          phone_number: r.call.phone_number,
          analysis_status: r.call.analysis_status,
          primary_intent: r.call.primary_intent,
          analysis_confidence: r.call.analysis_confidence,
          summary: r.call.summary,
          transcript_text: r.call.transcript_text,
          transcript_cleaned: r.call.transcript_cleaned,
          recording_url: r.call.recording_url,
          analysis_error_code: r.call.analysis_error_code,
        },
      })),
    });
  } catch (e) {
    console.error("[review candidates]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

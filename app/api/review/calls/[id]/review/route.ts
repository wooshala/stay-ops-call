import { updateReviewState } from "@/lib/db/reviewPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: "save" | "verify" | "reject" | "reanalyze";
      reviewed_by?: string | null;
      summary?: string | null;
      primary_intent?: string | null;
      review_note?: string | null;
      checkin_date?: string | null;
      checkout_date?: string | null;
      amount?: number | null;
      room_no?: string | null;
      issue_type?: string | null;
    };

    const action = body.action ?? "save";
    await updateReviewState({
      callId: id,
      action,
      reviewedBy: body.reviewed_by,
      patch: {
        summary: body.summary,
        primary_intent: body.primary_intent,
        review_note: body.review_note,
        checkin_date: body.checkin_date,
        checkout_date: body.checkout_date,
        amount: body.amount,
        room_no: body.room_no,
        issue_type: body.issue_type,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[review/calls/:id/review]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

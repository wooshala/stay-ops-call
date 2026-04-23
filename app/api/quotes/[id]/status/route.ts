import { getQuoteDetail, updateQuoteStatus, type QuoteStatus } from "@/lib/db/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: QuoteStatus[] = ["ready", "accepted", "rejected", "expired"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: QuoteStatus };
    if (!body.status || !ALLOWED.includes(body.status)) {
      return Response.json({ error: "Invalid target status" }, { status: 400 });
    }

    const detail = await getQuoteDetail(id);
    const current = detail.quote;
    if (!current) return Response.json({ error: "Quote not found" }, { status: 404 });

    const valid =
      (current.status === "draft" && body.status === "ready") ||
      (current.status === "sent" &&
        (body.status === "accepted" || body.status === "rejected" || body.status === "expired"));
    if (!valid) {
      return Response.json(
        {
          error: `Invalid transition: ${current.status} -> ${body.status}`,
        },
        { status: 400 },
      );
    }
    if (current.status === "draft" && body.status === "ready") {
      if (!current.quote_text || current.quote_text.trim().length === 0) {
        return Response.json(
          { error: "quote_text is required before ready" },
          { status: 400 },
        );
      }
    }

    const updated = await updateQuoteStatus({ id, nextStatus: body.status });
    return Response.json({ ok: true, quote: updated });
  } catch (e) {
    console.error("[POST /api/quotes/[id]/status]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Status update failed" },
      { status: 500 },
    );
  }
}

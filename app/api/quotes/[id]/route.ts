import { getQuoteDetail, updateQuoteEditableFields } from "@/lib/db/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const detail = await getQuoteDetail(id);
    if (!detail.quote) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }
    return Response.json({ ok: true, ...detail });
  } catch (e) {
    console.error("[GET /api/quotes/[id]]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Load quote failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      quote_text?: string;
      final_amount?: number | null;
      customer_name?: string | null;
      internal_memo?: string | null;
      updated_by?: string | null;
    };
    const updated = await updateQuoteEditableFields({
      id,
      quote_text: body.quote_text,
      final_amount: body.final_amount,
      customer_name: body.customer_name,
      internal_memo: body.internal_memo,
      updated_by: body.updated_by ?? null,
    });
    if (!updated) {
      return Response.json({ error: "Quote not found" }, { status: 404 });
    }
    return Response.json({ ok: true, quote: updated });
  } catch (e) {
    console.error("[PATCH /api/quotes/[id]]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Update quote failed" },
      { status: 500 },
    );
  }
}

import {
  getQuoteDetail,
  insertQuoteMessage,
  markQuoteSendFailed,
  markQuoteSent,
} from "@/lib/db/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fakeSendByPhone(phone: string | null): { ok: boolean; providerMessageId: string | null; error: string | null } {
  if (!phone || phone.trim().length < 9) {
    return { ok: false, providerMessageId: null, error: "수신자 전화번호 부족" };
  }
  if (phone.endsWith("0000")) {
    return { ok: false, providerMessageId: null, error: "Fake provider rejected recipient" };
  }
  return {
    ok: true,
    providerMessageId: `mock_${Date.now()}`,
    error: null,
  };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const detail = await getQuoteDetail(id);
    const quote = detail.quote;
    if (!quote) return Response.json({ error: "Quote not found" }, { status: 404 });
    if (quote.status !== "ready") {
      return Response.json({ error: "Only ready quotes can be sent" }, { status: 400 });
    }
    if (!quote.quote_text || quote.quote_text.trim().length === 0) {
      return Response.json({ error: "quote_text is empty" }, { status: 400 });
    }

    const sender = fakeSendByPhone(quote.customer_phone);
    if (sender.ok) {
      const msg = await insertQuoteMessage({
        quoteId: quote.id,
        channel: "sms",
        recipient: quote.customer_phone ?? "",
        messageText: quote.quote_text,
        sendStatus: "sent",
        provider: "fake-provider",
        providerMessageId: sender.providerMessageId,
        errorMessage: null,
      });
      await markQuoteSent({ quoteId: quote.id });
      return Response.json({ ok: true, message: msg, sent: true });
    }

    const failed = await insertQuoteMessage({
      quoteId: quote.id,
      channel: "sms",
      recipient: quote.customer_phone ?? "",
      messageText: quote.quote_text,
      sendStatus: "failed",
      provider: "fake-provider",
      providerMessageId: null,
      errorMessage: sender.error,
    });
    await markQuoteSendFailed({ quoteId: quote.id, reason: sender.error ?? "send failed" });
    return Response.json({ ok: false, message: failed, sent: false }, { status: 502 });
  } catch (e) {
    console.error("[POST /api/quotes/[id]/send]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 500 },
    );
  }
}

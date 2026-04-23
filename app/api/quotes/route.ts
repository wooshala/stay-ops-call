import { getCallById } from "@/lib/db/calls";
import {
  createQuote,
  listQuotes,
  mapDraftToQuoteCreate,
  type QuoteSource,
  type QuoteStatus,
} from "@/lib/db/quotes";
import type { QuoteDraft } from "@/services/quote-engine";
import { buildQuoteDraft } from "@/services/quote-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const sourceRaw = url.searchParams.get("source");
    const needsReviewRaw = url.searchParams.get("needs_review");
    const phone = url.searchParams.get("phone") ?? undefined;
    const sentRaw = url.searchParams.get("sent");
    const hasSendHistoryRaw = url.searchParams.get("has_send_history");

    const status = (["draft", "ready", "sent", "accepted", "rejected", "expired"].includes(
      statusRaw ?? "",
    )
      ? statusRaw
      : undefined) as QuoteStatus | undefined;
    const source = (["auto", "manual", "imported"].includes(sourceRaw ?? "")
      ? sourceRaw
      : undefined) as QuoteSource | undefined;
    const needsReview =
      needsReviewRaw === "true" ? true : needsReviewRaw === "false" ? false : undefined;
    const sent = sentRaw === "true" ? true : sentRaw === "false" ? false : undefined;
    const hasSendHistory =
      hasSendHistoryRaw === "true" ? true : hasSendHistoryRaw === "false" ? false : undefined;

    const quotes = await listQuotes({ status, source, needsReview, phone, sent, hasSendHistory });
    return Response.json({ ok: true, quotes });
  } catch (e) {
    console.error("[GET /api/quotes]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "List quotes failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      call_id?: string;
      draft?: QuoteDraft;
      source?: QuoteSource;
    };

    if (!body.call_id) {
      return Response.json(
        { error: "call_id is required" },
        { status: 400 },
      );
    }

    const draft = body.draft ?? null;
    let effectiveDraft = draft;
    if (!effectiveDraft) {
      const call = await getCallById(body.call_id);
      if (!call) {
        return Response.json({ error: "Call not found" }, { status: 404 });
      }
      const parsedFallback = (() => {
        if (!call.quote_draft) return null;
        try {
          return JSON.parse(call.quote_draft) as Partial<QuoteDraft>;
        } catch {
          return null;
        }
      })();
      const base = buildQuoteDraft({
        id: call.id,
        phone_number: call.phone_number,
        source_file_name: call.source_file_name ?? null,
        transcript: call.transcript_text,
        summary: call.summary,
        inquiry_type: call.primary_intent,
      });
      effectiveDraft = { ...base, ...(parsedFallback ?? {}) };
    }
    if (!effectiveDraft) {
      return Response.json({ error: "Draft build failed" }, { status: 500 });
    }

    const transformed = mapDraftToQuoteCreate({
      callId: body.call_id,
      draft: effectiveDraft,
      source: body.source ?? "auto",
    });
    const created = await createQuote(transformed);
    return Response.json({ ok: true, quote: created });
  } catch (e) {
    console.error("[POST /api/quotes]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Create quote failed" },
      { status: 500 },
    );
  }
}

import { getServiceSupabase } from "@/lib/supabase/server";
import type { QuoteDraft } from "@/services/quote-engine";

export type QuoteSource = "auto" | "manual" | "imported";
export type QuoteStatus = "draft" | "ready" | "sent" | "accepted" | "rejected" | "expired";
export type QuoteChannel = "sms" | "kakao" | "email" | "manual";
export type QuoteMessageSendStatus = "pending" | "sent" | "failed";

export interface QuoteRow {
  id: string;
  call_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  source: QuoteSource;
  status: QuoteStatus;
  title: string | null;
  summary: string | null;
  quote_text: string | null;
  internal_memo: string | null;
  total_amount: number | null;
  final_amount: number | null;
  parse_confidence: number | null;
  quote_confidence: number | null;
  needs_review: boolean;
  review_reason: string | null;
  failure_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  external_sync_status: string | null;
  external_sync_target: string | null;
  external_sync_at: string | null;
  external_ref_id: string | null;
  source_system: string | null;
  source_reference_id: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteMessageRow {
  id: string;
  quote_id: string;
  channel: QuoteChannel;
  recipient: string;
  message_text: string;
  send_status: QuoteMessageSendStatus;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface QuoteVersionRow {
  id: string;
  quote_id: string;
  version_no: number;
  draft_text: string;
  payload: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateQuoteInput {
  call_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  source: QuoteSource;
  status: QuoteStatus;
  title: string | null;
  summary: string | null;
  quote_text: string | null;
  internal_memo: string | null;
  total_amount: number | null;
  final_amount: number | null;
  parse_confidence: number | null;
  quote_confidence: number | null;
  needs_review: boolean;
  review_reason: string | null;
  failure_reason: string | null;
  source_system: string | null;
  source_reference_id: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface ListQuotesFilters {
  status?: QuoteStatus;
  source?: QuoteSource;
  needsReview?: boolean;
  phone?: string;
  sent?: boolean;
  hasSendHistory?: boolean;
}

export function evaluateNeedsReview(input: {
  parseConfidence: number | null;
  quoteConfidence: number | null;
  requiredValues: Array<string | number | null | undefined>;
}): { needsReview: boolean; reason: string | null } {
  const parseLow = typeof input.parseConfidence === "number" && input.parseConfidence < 0.75;
  const quoteLow = typeof input.quoteConfidence === "number" && input.quoteConfidence < 0.75;
  const missingRequired = input.requiredValues.some((v) => v == null || v === "");
  if (missingRequired) return { needsReview: true, reason: "필수값 누락" };
  if (parseLow || quoteLow) return { needsReview: true, reason: "confidence 낮음(<0.75)" };
  return { needsReview: false, reason: null };
}

export function mapDraftToQuoteCreate(input: {
  callId: string;
  draft: QuoteDraft;
  source?: QuoteSource;
}): CreateQuoteInput {
  const parseConfidence = 0.8;
  const quoteConfidence = 0.8;
  const review = evaluateNeedsReview({
    parseConfidence,
    quoteConfidence,
    requiredValues: [input.draft.phoneNumber, input.draft.messageDraft, input.draft.selectedRoomType],
  });
  return {
    call_id: input.callId,
    customer_phone: input.draft.phoneNumber,
    customer_name: null,
    source: input.source ?? "auto",
    status: "draft",
    title: "자동 견적",
    summary: input.draft.callSummary ?? "",
    quote_text: input.draft.messageDraft || null,
    internal_memo: null,
    total_amount: input.draft.priceSnapshot.price == null ? null : Math.round(input.draft.priceSnapshot.price),
    final_amount: input.draft.priceSnapshot.price == null ? null : Math.round(input.draft.priceSnapshot.price),
    parse_confidence: parseConfidence,
    quote_confidence: quoteConfidence,
    needs_review: review.needsReview,
    review_reason: review.reason,
    failure_reason: review.reason,
    source_system: "web_quote_engine",
    source_reference_id: input.callId,
    finalized_by: null,
    finalized_at: null,
    created_by: null,
    updated_by: null,
    metadata_json: {
      draftStatus: input.draft.status,
      priceSnapshot: input.draft.priceSnapshot,
      requestedDate: input.draft.requestedDate,
      requestedWeekday: input.draft.requestedWeekday,
      stayType: input.draft.stayType,
      selectedRoomType: input.draft.selectedRoomType,
    },
  };
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteRow> {
  const supabase = getServiceSupabase();
  const row = {
    ...input,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("quotes")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;
  const created = data as QuoteRow;
  await appendQuoteVersion({
    quoteId: created.id,
    draftText: created.quote_text ?? "",
    payload: { event: "created", source: created.source, status: created.status },
    createdBy: created.created_by,
  });
  return created;
}

export async function listQuotes(filters: ListQuotesFilters): Promise<QuoteRow[]> {
  const supabase = getServiceSupabase();
  let q = supabase.from("quotes").select("*").order("updated_at", { ascending: false }).limit(500);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.source) q = q.eq("source", filters.source);
  if (filters.needsReview !== undefined) q = q.eq("needs_review", filters.needsReview);
  if (filters.phone) q = q.ilike("customer_phone", `%${filters.phone.replace(/%/g, "\\%")}%`);
  if (filters.sent === true) q = q.eq("status", "sent");
  if (filters.sent === false) q = q.neq("status", "sent");
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as QuoteRow[];
  if (filters.hasSendHistory !== undefined) {
    const { data: msgRows, error: msgErr } = await supabase
      .from("quote_messages")
      .select("quote_id");
    if (msgErr) throw msgErr;
    const ids = new Set((msgRows ?? []).map((r) => (r as { quote_id: string }).quote_id));
    rows = rows.filter((r) => (filters.hasSendHistory ? ids.has(r.id) : !ids.has(r.id)));
  }
  return rows;
}

export async function listQuoteIdsWithFailedMessages(): Promise<Set<string>> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("quote_messages")
    .select("quote_id")
    .eq("send_status", "failed");
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { quote_id: string }).quote_id));
}

export async function getQuoteDetail(id: string): Promise<{
  quote: QuoteRow | null;
  messages: QuoteMessageRow[];
  versions: QuoteVersionRow[];
}> {
  const supabase = getServiceSupabase();
  const [quoteRes, msgRes, verRes] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_messages").select("*").eq("quote_id", id).order("created_at", { ascending: false }),
    supabase.from("quote_versions").select("*").eq("quote_id", id).order("version_no", { ascending: false }),
  ]);
  if (quoteRes.error) throw quoteRes.error;
  if (msgRes.error) throw msgRes.error;
  if (verRes.error) throw verRes.error;
  return {
    quote: (quoteRes.data ?? null) as QuoteRow | null,
    messages: (msgRes.data ?? []) as QuoteMessageRow[],
    versions: (verRes.data ?? []) as QuoteVersionRow[],
  };
}

export async function updateQuoteEditableFields(input: {
  id: string;
  quote_text?: string;
  final_amount?: number | null;
  customer_name?: string | null;
  internal_memo?: string | null;
  updated_by?: string | null;
}): Promise<QuoteRow | null> {
  const supabase = getServiceSupabase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.quote_text !== undefined) patch.quote_text = input.quote_text;
  if (input.final_amount !== undefined) patch.final_amount = input.final_amount == null ? null : Math.round(input.final_amount);
  if (input.customer_name !== undefined) patch.customer_name = input.customer_name;
  if (input.internal_memo !== undefined) patch.internal_memo = input.internal_memo;
  patch.updated_by = input.updated_by ?? null;

  const { data, error } = await supabase.from("quotes").update(patch).eq("id", input.id).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await appendQuoteVersion({
    quoteId: input.id,
    draftText: (data as QuoteRow).quote_text ?? "",
    payload: patch,
    createdBy: input.updated_by ?? null,
  });
  return data as QuoteRow;
}

export async function updateQuoteStatus(input: { id: string; nextStatus: QuoteStatus }): Promise<QuoteRow | null> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.nextStatus, updated_at: now };
  if (input.nextStatus === "accepted") patch.accepted_at = now;
  if (input.nextStatus === "rejected") patch.rejected_at = now;
  if (input.nextStatus === "expired") patch.expired_at = now;
  const { data, error } = await supabase.from("quotes").update(patch).eq("id", input.id).select("*").maybeSingle();
  if (error) throw error;
  return (data ?? null) as QuoteRow | null;
}

export async function appendQuoteVersion(input: {
  quoteId: string;
  draftText: string;
  payload: Record<string, unknown>;
  createdBy: string | null;
}): Promise<void> {
  const supabase = getServiceSupabase();
  const { data: latest, error: latestErr } = await supabase
    .from("quote_versions")
    .select("version_no")
    .eq("quote_id", input.quoteId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  const nextNo = ((latest as { version_no?: number } | null)?.version_no ?? 0) + 1;
  const { error } = await supabase.from("quote_versions").insert({
    quote_id: input.quoteId,
    version_no: nextNo,
    draft_text: input.draftText,
    payload: input.payload,
    created_by: input.createdBy,
  });
  if (error) throw error;
}

export async function insertQuoteMessage(input: {
  quoteId: string;
  channel: QuoteChannel;
  recipient: string;
  messageText: string;
  sendStatus: QuoteMessageSendStatus;
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
}): Promise<QuoteMessageRow> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("quote_messages")
    .insert({
      quote_id: input.quoteId,
      channel: input.channel,
      recipient: input.recipient,
      message_text: input.messageText,
      send_status: input.sendStatus,
      provider: input.provider,
      provider_message_id: input.providerMessageId,
      error_message: input.errorMessage,
      sent_at: input.sendStatus === "sent" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as QuoteMessageRow;
}

export async function markQuoteSent(input: { quoteId: string }): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", input.quoteId);
  if (error) throw error;
}

export async function markQuoteSendFailed(input: { quoteId: string; reason: string }): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      needs_review: true,
      review_reason: "send_failed",
      failure_reason: input.reason,
      updated_at: now,
    })
    .eq("id", input.quoteId);
  if (error) throw error;
}

import { getServiceSupabase } from "@/lib/supabase/server";
import type { RoomType } from "@/services/quote-engine";

export type QuoteDraftListFilter = "all" | "needs_review" | "ready";

export type QuoteDraftListRow = {
  callId: string;
  phoneNumber: string | null;
  callSummary: string;
  selectedRoomType: RoomType | null;
  status: string;
  updatedAt: string;
  canSend: boolean;
};

type StoredQuoteDraft = {
  selectedRoomType?: RoomType | null;
  status?: string | null;
  messageDraft?: string | null;
  needsReviewReason?: string | null;
  needsReviewReasons?: string[] | null;
  priceSnapshot?: {
    roomType?: RoomType | null;
    price?: number | null;
    pricingSource?: string | null;
    appliedDate?: string | null;
  } | null;
  updatedAt?: string | null;
};

function safeParseQuoteDraft(raw: string | null): StoredQuoteDraft | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredQuoteDraft;
  } catch {
    return null;
  }
}

function inferCanSend(draft: StoredQuoteDraft): boolean {
  const hasRoom = Boolean(draft.selectedRoomType);
  const hasPrice = typeof draft.priceSnapshot?.price === "number";
  const hasMessage = Boolean(draft.messageDraft && draft.messageDraft.trim().length > 0);
  const hasReviewBlocks =
    (draft.needsReviewReasons?.length ?? 0) > 0 || Boolean(draft.needsReviewReason);
  const statusReady = draft.status === "draft";
  return statusReady && hasRoom && hasPrice && hasMessage && !hasReviewBlocks;
}

function matchesFilter(filter: QuoteDraftListFilter, row: QuoteDraftListRow): boolean {
  if (filter === "needs_review") return row.status === "needs_review";
  if (filter === "ready") return row.canSend;
  return true;
}

export async function listQuoteDraftRows(
  filter: QuoteDraftListFilter,
): Promise<QuoteDraftListRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("id, phone_number, summary, quote_draft, updated_at")
    .not("quote_draft", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  const rows: QuoteDraftListRow[] = [];
  for (const item of data ?? []) {
    const record = item as {
      id: string;
      phone_number: string | null;
      summary: string | null;
      quote_draft: string | null;
      updated_at: string;
    };

    const parsed = safeParseQuoteDraft(record.quote_draft);
    if (!parsed) continue;

    const row: QuoteDraftListRow = {
      callId: record.id,
      phoneNumber: record.phone_number,
      callSummary: record.summary ?? "",
      selectedRoomType: parsed.selectedRoomType ?? null,
      status: parsed.status ?? "draft",
      updatedAt: parsed.updatedAt ?? record.updated_at,
      canSend: inferCanSend(parsed),
    };

    if (matchesFilter(filter, row)) {
      rows.push(row);
    }
  }

  return rows;
}

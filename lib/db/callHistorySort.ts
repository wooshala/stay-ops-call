/**
 * 통화내역 목록 정렬 계약 (DB ORDER BY 와 동일 의미).
 * PostgREST: .order(col, { ascending: false, nullsFirst: false }) ⇒ NULLS LAST.
 */
export type CallHistorySortKey = {
  startedAt: string | null;
  createdAt: string;
  id: string;
};

/** Supabase/PostgREST order chain used by listCallHistory. */
export const CALL_HISTORY_ORDER = [
  {
    column: "started_at",
    options: { ascending: false, nullsFirst: false },
  },
  {
    column: "created_at",
    options: { ascending: false },
  },
  {
    column: "id",
    options: { ascending: false },
  },
] as const;

/**
 * Compare two rows for started_at DESC NULLS LAST, created_at DESC, id DESC.
 * Returns negative if a should appear before b (higher in a DESC list).
 */
export function compareCallHistorySort(
  a: CallHistorySortKey,
  b: CallHistorySortKey,
): number {
  const aNull = a.startedAt == null || a.startedAt === "";
  const bNull = b.startedAt == null || b.startedAt === "";
  if (aNull !== bNull) {
    // NULLS LAST under DESC ⇒ non-null first
    return aNull ? 1 : -1;
  }
  if (!aNull && !bNull) {
    const aTs = Date.parse(a.startedAt!);
    const bTs = Date.parse(b.startedAt!);
    if (aTs !== bTs) return bTs - aTs; // DESC
  }
  const aCreated = Date.parse(a.createdAt);
  const bCreated = Date.parse(b.createdAt);
  if (aCreated !== bCreated) return bCreated - aCreated; // DESC
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1; // id DESC (lexicographic for UUID strings)
}

export function sortCallHistoryKeys<T extends CallHistorySortKey>(rows: T[]): T[] {
  return [...rows].sort(compareCallHistorySort);
}

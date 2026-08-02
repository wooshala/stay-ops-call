/**
 * 통화내역 검색어(q) 검증·PostgREST 필터 생성 (순수 함수).
 *
 * 1차 검색: 입력 문자열 전체 부분 일치(ILIKE). 공백 AND 토큰 검색은 범위 밖.
 * 검색어 원문은 서버 로그에 남기지 말 것(호출부 책임).
 */
export const CALL_HISTORY_Q_MAX_LEN = 100;
export const MATCHED_PHONES_MAX = 100;

export class CallHistoryQueryValidationError extends Error {
  readonly status = 400;
  readonly code = "INVALID_SEARCH_QUERY";
  constructor(message: string) {
    super(message);
    this.name = "CallHistoryQueryValidationError";
  }
}

export type ResolvedSearchQuery = {
  q: string | null;
  digits: string | null;
};

export function resolveSearchQuery(raw: string | null | undefined): ResolvedSearchQuery {
  if (raw == null) return { q: null, digits: null };
  const trimmed = raw.trim();
  if (trimmed === "") return { q: null, digits: null };
  if (trimmed.length > CALL_HISTORY_Q_MAX_LEN) {
    throw new CallHistoryQueryValidationError(
      `q must be at most ${CALL_HISTORY_Q_MAX_LEN} characters`,
    );
  }
  const digits = trimmed.replace(/\D/g, "");
  return {
    q: trimmed,
    digits: digits.length >= 2 ? digits : null,
  };
}

/** ILIKE 와일드카드 이스케이프 후 %term% 패턴. */
export function buildIlikePattern(term: string): string {
  const escaped = term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/** PostgREST or() 값 — 항상 따옴표로 감싸 `,().%_` 등 문법 깨짐 방지. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * calls OR 필터. transcript_text 는 WHERE 전용(LIST select 금지).
 */
export function buildCallHistorySearchOrFilter(args: {
  q: string;
  digits: string | null;
  matchedPhones?: string[];
}): string {
  const pattern = quoteFilterValue(buildIlikePattern(args.q));
  const parts = [
    `phone_number.ilike.${pattern}`,
    `normalized_phone.ilike.${pattern}`,
    `primary_intent.ilike.${pattern}`,
    `summary.ilike.${pattern}`,
    `transcript_text.ilike.${pattern}`,
  ];
  if (args.digits) {
    const dp = quoteFilterValue(buildIlikePattern(args.digits));
    parts.push(`phone_number.ilike.${dp}`);
    parts.push(`normalized_phone.ilike.${dp}`);
  }
  const phones = normalizeMatchedPhones(args.matchedPhones ?? []);
  if (phones.length > 0) {
    const list = phones.map((p) => `"${p}"`).join(",");
    parts.push(`normalized_phone.in.(${list})`);
    parts.push(`phone_number.in.(${list})`);
  }
  return parts.join(",");
}

export function normalizeMatchedPhones(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of raw) {
    const digits = p.replace(/\D/g, "");
    if (digits.length < 4 || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
    if (out.length >= MATCHED_PHONES_MAX) break;
  }
  return out;
}

/** matchedPhones 쿼리 파싱 (comma-separated, max 100). */
export function parseMatchedPhones(raw: string | null | undefined): string[] {
  if (raw == null || raw.trim() === "") return [];
  return normalizeMatchedPhones(raw.split(","));
}

/**
 * 통화내역 검색어(q) 검증 — 순수 함수.
 *
 * 계약:
 *  - 없거나 trim 후 빈 문자열 → null (필터 없음, 기존 목록과 동일)
 *  - 길이 1..100
 *  - 101자 이상 → ValidationError (잘라내지 않음)
 *  - 1차: 단일 문자열 부분일치 (공백 AND 토큰 미적용 — 문서화)
 */
export const CALL_HISTORY_Q_MAX_LEN = 100;

export class CallHistoryQueryValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "CallHistoryQueryValidationError";
  }
}

export type ResolvedSearchQuery = {
  /** trim 된 검색어. null 이면 검색 필터 없음 */
  q: string | null;
  /** 숫자만 추출한 값(전화번호 보조 매칭). 2자 미만이면 null */
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

/** PostgREST or() 값용 ILIKE 패턴 이스케이프 + 필요 시 따옴표. */
export function buildIlikePattern(term: string): string {
  const escaped = term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

function quoteFilterValue(value: string): string {
  if (/[,():]/.test(value) || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * calls 테이블 OR 필터 문자열.
 * LIST select 에는 transcript_text 를 넣지 않되, WHERE 에는 포함 가능.
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
  const phones = (args.matchedPhones ?? [])
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length >= 4)
    .slice(0, 100);
  if (phones.length > 0) {
    const list = phones.map((p) => `"${p}"`).join(",");
    parts.push(`normalized_phone.in.(${list})`);
    parts.push(`phone_number.in.(${list})`);
  }
  return parts.join(",");
}

/** matchedPhones 쿼리 파싱 (comma-separated, max 100). */
export function parseMatchedPhones(raw: string | null | undefined): string[] {
  if (raw == null || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length >= 4)
    .slice(0, 100);
}

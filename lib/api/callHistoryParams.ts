/**
 * 통화내역(30일) 목록 파라미터 파싱·클램프 (순수 함수 — DB/네트워크 없음).
 *
 * 계약:
 *  - to   기본값 = 현재
 *  - from 기본값 = to - 30일
 *  - 최대 조회 기간 = 90일 (초과 시 from 을 to-90일로 절단)
 *  - page ≥ 1, pageSize 1..100 (기본 50)
 *  - q optional (1..100). 빈 문자열 → 필터 없음. 101+ → ValidationError
 */

import {
  parseMatchedPhones,
  resolveSearchQuery,
  type ResolvedSearchQuery,
} from "@/lib/api/callHistorySearch";

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 90;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CallHistoryParams = {
  fromIso: string;
  toIso: string;
  page: number;
  pageSize: number;
  search: ResolvedSearchQuery;
  matchedPhones: string[];
};

function parseIntOr(raw: string | null, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseTimeOr(raw: string | null, fallbackMs: number): number {
  if (raw == null || raw.trim() === "") return fallbackMs;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : fallbackMs;
}

export function resolveCallHistoryParams(
  query: URLSearchParams,
  nowMs: number = Date.now(),
): CallHistoryParams {
  const toMs = parseTimeOr(query.get("to"), nowMs);
  const defaultFromMs = toMs - DEFAULT_RANGE_DAYS * DAY_MS;
  let fromMs = parseTimeOr(query.get("from"), defaultFromMs);

  // from 이 to 이후이면 기본 30일로 되돌림
  if (fromMs > toMs) fromMs = defaultFromMs;

  // 최대 조회 기간 90일 절단
  const minFromMs = toMs - MAX_RANGE_DAYS * DAY_MS;
  if (fromMs < minFromMs) fromMs = minFromMs;

  const page = Math.max(1, parseIntOr(query.get("page"), 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseIntOr(query.get("pageSize"), DEFAULT_PAGE_SIZE)),
  );

  const search = resolveSearchQuery(query.get("q"));
  const matchedPhones = parseMatchedPhones(query.get("matchedPhones"));

  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
    page,
    pageSize,
    search,
    matchedPhones,
  };
}

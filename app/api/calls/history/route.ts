/**
 * GET /api/calls/history — 최근 통화 목록(30일 기본, 최대 90일).
 * 인증: Bearer INTERNAL_API_TOKEN (미설정 → 503, 불일치 → 401). public 금지.
 * 목록은 transcript/recording/error 원문 미포함.
 * q optional: 서버 검색(phone/intent/summary/transcript + matchedPhones).
 */
import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
import { CallHistoryQueryValidationError } from "@/lib/api/callHistorySearch";
import { resolveCallHistoryParams } from "@/lib/api/callHistoryParams";
import {
  describeDbError,
  listCallHistory,
  LIST_COLUMN_COUNT,
} from "@/lib/db/callHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertHistoryAuthorized(request: Request): Response | null {
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  if (!expected) {
    return Response.json(
      { error: "INTERNAL_API_TOKEN not configured" },
      { status: 503 },
    );
  }
  const bearer = getBearerTokenFromRequest(request);
  if (bearer !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  const unauthorized = assertHistoryAuthorized(request);
  if (unauthorized) return unauthorized;

  const startedMs = Date.now();
  let params: ReturnType<typeof resolveCallHistoryParams> | null = null;

  try {
    const url = new URL(request.url);
    params = resolveCallHistoryParams(url.searchParams);
    const { fromIso, toIso, page, pageSize, search, matchedPhones } = params;
    const result = await listCallHistory({
      fromIso,
      toIso,
      page,
      pageSize,
      q: search.q,
      digits: search.digits,
      matchedPhones,
    });
    return Response.json({
      ok: true,
      from: fromIso,
      to: toIso,
      ...result,
    });
  } catch (e) {
    if (e instanceof CallHistoryQueryValidationError) {
      return Response.json({ ok: false, error: e.message }, { status: 400 });
    }
    const { code, message } = describeDbError(e);
    console.error("[CALL_HISTORY] list failed", {
      route: "/api/calls/history",
      from: params?.fromIso ?? null,
      to: params?.toIso ?? null,
      page: params?.page ?? null,
      pageSize: params?.pageSize ?? null,
      has_q: Boolean(params?.search.q),
      cols: LIST_COLUMN_COUNT,
      code,
      message,
      elapsed_ms: Date.now() - startedMs,
    });
    return Response.json(
      { error: e instanceof Error ? e.message : "Load failed" },
      { status: 500 },
    );
  }
}

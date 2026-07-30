/**
 * GET /api/calls/history — 최근 통화 목록(30일 기본, 최대 90일).
 * 인증: Bearer INTERNAL_API_TOKEN (미설정 → 503, 불일치 → 401). public 금지.
 * 목록은 transcript/recording/error 원문 미포함.
 */
import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
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
  // catch 에서도 참조하므로 try 밖에서 선언(파싱 실패 시 null 로 남는다).
  let params: ReturnType<typeof resolveCallHistoryParams> | null = null;

  try {
    const url = new URL(request.url);
    params = resolveCallHistoryParams(url.searchParams);
    const { fromIso, toIso, page, pageSize } = params;
    const result = await listCallHistory({ fromIso, toIso, page, pageSize });
    return Response.json({
      ok: true,
      from: fromIso,
      to: toIso,
      ...result,
    });
  } catch (e) {
    // 진단 로그: 조회 조건 + DB 에러 코드만. 전화번호/summary/transcript/
    // recording_path/secret 은 포함하지 않는다.
    const { code, message } = describeDbError(e);
    console.error("[CALL_HISTORY] list failed", {
      route: "/api/calls/history",
      from: params?.fromIso ?? null,
      to: params?.toIso ?? null,
      page: params?.page ?? null,
      pageSize: params?.pageSize ?? null,
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

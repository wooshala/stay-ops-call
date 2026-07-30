/**
 * GET /api/calls/history/:id — 통화 상세(원문 포함, 조회 전용 whitelist).
 * 인증: Bearer INTERNAL_API_TOKEN (미설정 → 503, 불일치 → 401). public 금지.
 * 오디오 URL·내부 오류 원문은 1차에서 반환하지 않는다.
 */
import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
import { describeDbError, getCallHistoryDetail } from "@/lib/db/callHistory";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = assertHistoryAuthorized(request);
  if (unauthorized) return unauthorized;

  const startedMs = Date.now();
  let callId: string | null = null;

  try {
    const { id } = await context.params;
    callId = id;
    const detail = await getCallHistoryDetail(id);
    if (!detail) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ ok: true, call: detail });
  } catch (e) {
    // 진단 로그: id(uuid)와 DB 에러 코드만. transcript/summary/전화번호는 제외.
    const { code, message } = describeDbError(e);
    console.error("[CALL_HISTORY] detail failed", {
      route: "/api/calls/history/[id]",
      id: callId,
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

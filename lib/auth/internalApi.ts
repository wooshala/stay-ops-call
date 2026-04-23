/**
 * 최소 내부 API 인증: Authorization: Bearer <INTERNAL_API_TOKEN>
 *
 * - INTERNAL_API_TOKEN 이 비어 있지 않으면 Bearer 일치 필수
 * - 비어 있으면: production → 401, development → 우회 + 경고 로그
 */

const LOG_PREFIX = "[auth][internal-api]";

export function getBearerTokenFromRequest(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() ?? null;
}

/**
 * @returns null 이면 통과, Response 이면 그대로 return 하면 됨(401 등)
 */
export function assertInternalApiAuthorized(
  request: Request,
  logContext?: string,
): Response | null {
  const expected = process.env.INTERNAL_API_TOKEN?.trim();
  const ctx = logContext ? ` ${logContext}` : "";

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `${LOG_PREFIX} INTERNAL_API_TOKEN is required in production${ctx}`,
      );
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.warn(
      `${LOG_PREFIX} INTERNAL_API_TOKEN missing; bypass enabled in development${ctx}`,
    );
    return null;
  }

  const bearer = getBearerTokenFromRequest(request);
  if (bearer !== expected) {
    console.warn(`${LOG_PREFIX} unauthorized${ctx}`);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

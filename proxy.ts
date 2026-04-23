import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * API Key 인증 미들웨어.
 * INTERNAL_API_KEY 환경변수가 설정된 경우 모든 /api/* 요청에 x-api-key 헤더 검사.
 * 미설정 시 (개발 환경) 검사 생략.
 */
export function proxy(request: NextRequest) {
  const internalApiKey = process.env.INTERNAL_API_KEY;

  // 키 미설정 = 개발 모드, 인증 생략
  if (!internalApiKey) {
    return NextResponse.next();
  }

  const providedKey = request.headers.get("x-api-key");
  if (providedKey !== internalApiKey) {
    return NextResponse.json(
      { error: "Unauthorized", code: "MISSING_API_KEY" },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};

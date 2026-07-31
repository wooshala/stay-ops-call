import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
import { getStuckAnalysisQueueStats } from "@/lib/db/calls";
import { getOpenAIConfigProbe } from "@/lib/openai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health — Render/uptime probe (no secrets) */
export async function GET(request: Request) {
  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasSupabaseServiceRoleKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const hasUniverOpsUrl = Boolean(process.env.UNIVER_OPS_URL?.trim());
  const hasInternalEventsSecret = Boolean(
    process.env.INTERNAL_EVENTS_SECRET?.trim() ||
      process.env.UNIVER_OPS_SECRET?.trim(),
  );
  const hasInternalApiToken = Boolean(process.env.INTERNAL_API_TOKEN?.trim());
  const hasUploadBearer = Boolean(getBearerTokenFromRequest(request));
  const openai = getOpenAIConfigProbe();

  /**
   * 분석 큐 정체 지표 — 내부 토큰이 일치할 때만 집계한다.
   * (무인증 uptime 프로브마다 DB 를 때리지 않도록)
   * 정상값 stuckCount = 0. 1건 이상이면 종결 상태 기록 누락 신호.
   */
  let analysisQueue: Awaited<ReturnType<typeof getStuckAnalysisQueueStats>> | null =
    null;
  let analysisQueueError: string | null = null;
  const internalToken = process.env.INTERNAL_API_TOKEN?.trim();
  if (internalToken && getBearerTokenFromRequest(request) === internalToken) {
    try {
      analysisQueue = await getStuckAnalysisQueueStats();
    } catch (e) {
      analysisQueueError = e instanceof Error ? e.message : "query failed";
    }
  }

  return Response.json({
    ok: hasSupabaseUrl && hasSupabaseServiceRoleKey,
    service: "stay-ops-call",
    analysisVersion: "2",
    buildCommit:
      process.env.RENDER_GIT_COMMIT?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim()?.slice(0, 7) ||
      null,
    time: new Date().toISOString(),
    env: {
      hasSupabaseUrl,
      hasSupabaseServiceRoleKey,
      hasUniverOpsUrl,
      hasInternalEventsSecret,
      hasInternalApiToken,
      hasOpenaiApiKey: openai.hasApiKey,
      openaiBaseUrl: openai.baseUrl,
      openaiBaseUrlRaw: openai.baseUrlRaw,
      openaiBaseUrlRawInvalid: openai.baseUrlRawInvalid,
      sttProvider: openai.sttProvider,
      openaiSttModel: openai.sttModel,
      openaiSttModelConfigured: openai.sttModelConfigured,
    },
    probe: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      hasUploadBearer,
    },
    // 내부 토큰 없이 호출하면 null (집계 생략)
    analysisQueue,
    analysisQueueError,
  });
}

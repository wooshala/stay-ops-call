import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";
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

  return Response.json({
    ok: hasSupabaseUrl && hasSupabaseServiceRoleKey,
    service: "stay-ops-call",
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
    },
    probe: {
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      hasUploadBearer,
    },
  });
}

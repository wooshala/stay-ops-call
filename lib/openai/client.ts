import OpenAI from "openai";

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";

/** Normalize OPENAI_BASE_URL for the OpenAI SDK (never include /audio/transcriptions). */
export function normalizeOpenAIBaseUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  let base = trimmed.replace(/\/+$/, "");
  base = base.replace(/\/audio\/transcriptions$/i, "");

  if (base === "https://api.openai.com") {
    base = DEFAULT_OPENAI_BASE;
  }

  if (!base.endsWith("/v1")) {
    if (base.endsWith("/v1/")) {
      base = base.replace(/\/+$/, "");
    } else if (!/\/v1$/i.test(base)) {
      // Allow regional proxies that already end with /v1 in path
      const withoutV1 = !base.includes("/v1");
      if (withoutV1 && base.includes("api.openai.com")) {
        base = `${base}/v1`;
      }
    }
  }

  return base.replace(/\/+$/, "");
}

export function getOpenAIClientOptions(apiKey: string): {
  apiKey: string;
  baseURL?: string;
} {
  const baseURL = normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL);
  return baseURL ? { apiKey, baseURL } : { apiKey };
}

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI(getOpenAIClientOptions(apiKey));
}

export function getOpenAIConfigProbe(): {
  hasApiKey: boolean;
  baseUrl: string | null;
  baseUrlRawSet: boolean;
  sttModel: string;
  sttProvider: string;
  analysisModel: string;
} {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  const normalized = normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL);
  return {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    baseUrl: normalized ?? (raw ? null : DEFAULT_OPENAI_BASE),
    baseUrlRawSet: Boolean(raw),
    sttModel: process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-mini-transcribe",
    sttProvider: (process.env.STT_PROVIDER ?? "openai").toLowerCase(),
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function logOpenAISttConfig(context: string): void {
  const probe = getOpenAIConfigProbe();
  console.log("[OPENAI_STT_CONFIG]", {
    context,
    provider: probe.sttProvider,
    model: probe.sttModel,
    baseUrl: probe.baseUrl,
    baseUrlRawSet: probe.baseUrlRawSet,
    hasApiKey: probe.hasApiKey,
  });
}

/** Strip API keys / bearer tokens from error text before persisting to pending_events. */
export function sanitizeOpenAIErrorMessage(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

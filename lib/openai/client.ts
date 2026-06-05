import OpenAI from "openai";

export const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";

/**
 * Normalize OPENAI_BASE_URL for the OpenAI SDK.
 * Rejects relative paths (/v1, /) that cause `Invalid URL` on fetch.
 */
export function normalizeOpenAIBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_OPENAI_BASE;

  if (!/^https?:\/\//i.test(trimmed)) {
    console.warn("[OPENAI_STT_CONFIG] ignoring invalid OPENAI_BASE_URL (must be absolute http(s) URL)", {
      rawPrefix: trimmed.slice(0, 40),
    });
    return DEFAULT_OPENAI_BASE;
  }

  let base = trimmed.replace(/\/+$/, "");
  base = base.replace(/\/audio\/transcriptions$/i, "");

  if (base === "https://api.openai.com") {
    base = DEFAULT_OPENAI_BASE;
  }

  if (!base.endsWith("/v1")) {
    if (base.includes("api.openai.com")) {
      base = `${base}/v1`;
    }
  }

  return base.replace(/\/+$/, "");
}

export function getOpenAIClientOptions(apiKey: string): {
  apiKey: string;
  baseURL: string;
} {
  const baseURL = normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL);
  return { apiKey, baseURL };
}

export function createOpenAIClient(apiKey: string): OpenAI {
  const opts = getOpenAIClientOptions(apiKey);
  // Always pass baseURL explicitly — do not let the SDK read a bad OPENAI_BASE_URL from env.
  return new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
}

export function getOpenAIConfigProbe(): {
  hasApiKey: boolean;
  baseUrl: string;
  baseUrlRaw: string | null;
  baseUrlRawInvalid: boolean;
  sttModel: string;
  sttProvider: string;
  analysisModel: string;
} {
  const raw = process.env.OPENAI_BASE_URL?.trim() ?? null;
  const rawInvalid = Boolean(raw && !/^https?:\/\//i.test(raw));
  return {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    baseUrl: normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL),
    baseUrlRaw: raw,
    baseUrlRawInvalid: rawInvalid,
    sttModel: process.env.OPENAI_STT_MODEL?.trim() || "gpt-4o-mini-transcribe",
    sttProvider: (process.env.STT_PROVIDER ?? "openai").toLowerCase(),
    analysisModel: process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function logOpenAISttConfig(
  context: string,
  extra?: { model?: string; client?: OpenAI },
): void {
  const probe = getOpenAIConfigProbe();
  const baseURL = extra?.client?.baseURL ?? probe.baseUrl;
  console.log("[OPENAI_STT_CONFIG]", {
    context,
    provider: probe.sttProvider,
    model: extra?.model ?? probe.sttModel,
    baseURL,
    baseUrlRaw: probe.baseUrlRaw,
    baseUrlRawInvalid: probe.baseUrlRawInvalid,
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

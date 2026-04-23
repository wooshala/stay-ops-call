/**
 * Debug helper: call local /api/calls/{id}/analyze, then read calls.summary from Supabase.
 *
 * Usage (PowerShell):
 *   node .artifacts/debug-analyze-one-call.mjs <CALL_ID> [baseUrl]
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return {};
  const raw = readFileSync(p, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function internalApiJsonHeaders(env) {
  const headers = { "Content-Type": "application/json" };
  const t = env.INTERNAL_API_TOKEN?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

function preview(s, n = 140) {
  if (!s) return s;
  return s.length > n ? `${s.slice(0, n)}…[truncated:${s.length}]` : s;
}

async function main() {
  const callId = process.argv[2];
  const baseUrl = process.argv[3] || "http://localhost:3000";
  if (!callId) {
    console.error("Usage: node .artifacts/debug-analyze-one-call.mjs <CALL_ID> [baseUrl]");
    process.exit(1);
  }

  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env/.env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("== calling analyze ==");
  const res = await fetch(`${baseUrl}/api/calls/${callId}/analyze`, {
    method: "POST",
    headers: internalApiJsonHeaders(env),
    body: "{}",
  });
  const json = await res.json().catch(() => ({}));
  console.log("HTTP", res.status);
  console.log("analysis.summary (response preview):", preview(json?.analysis?.summary ?? null));
  console.log("bundle.call.summary (response preview):", preview(json?.bundle?.call?.summary ?? null));

  console.log("\n== reading DB calls.summary ==");
  const { data, error } = await supabase
    .from("calls")
    .select("id,analysis_status,summary,primary_intent,analysis_error_code,analysis_error_message,analysis_confidence,created_at,updated_at")
    .eq("id", callId)
    .maybeSingle();
  if (error) {
    console.error("DB error", error);
    process.exit(2);
  }
  console.log({
    id: data?.id ?? null,
    analysis_status: data?.analysis_status ?? null,
    primary_intent: data?.primary_intent ?? null,
    summary_preview: preview(data?.summary ?? null),
    summary_length: typeof data?.summary === "string" ? data.summary.length : 0,
    analysis_error_code: data?.analysis_error_code ?? null,
    analysis_error_message_preview: preview(data?.analysis_error_message ?? null),
    analysis_confidence: data?.analysis_confidence ?? null,
    created_at: data?.created_at ?? null,
    updated_at: data?.updated_at ?? null,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});


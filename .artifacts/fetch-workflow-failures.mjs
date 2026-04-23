/**
 * Fetch detailed fields for the 3 workflow failure cases from DB.
 *
 * Usage:
 *   node .artifacts/fetch-workflow-failures.mjs <CALL_ID> <CALL_ID> <CALL_ID>
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function preview(s, n = 180) {
  if (s == null) return null;
  const t = String(s);
  return t.length > n ? `${t.slice(0, n)}…[truncated:${t.length}]` : t;
}

async function main() {
  const ids = process.argv.slice(2).filter(Boolean);
  if (ids.length === 0) {
    console.error("Usage: node .artifacts/fetch-workflow-failures.mjs <CALL_ID> <CALL_ID> <CALL_ID>");
    process.exit(1);
  }
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const rows = [];
  for (const id of ids) {
    const { data, error } = await supabase
      .from("calls")
      .select(
        "id,source_file_name,primary_intent,analysis_status,workflow_status,workflow_error_code,workflow_error_message,analysis_error_code,analysis_error_message,analysis_confidence,summary,transcript_text,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    rows.push({
      call_id: id,
      file_name: data?.source_file_name ?? null,
      primary_intent: data?.primary_intent ?? null,
      analysis_status: data?.analysis_status ?? null,
      workflow_status: data?.workflow_status ?? null,
      workflow_error_code: data?.workflow_error_code ?? null,
      workflow_error_message: preview(data?.workflow_error_message ?? null),
      analysis_error_code: data?.analysis_error_code ?? null,
      analysis_error_message: preview(data?.analysis_error_message ?? null),
      analysis_confidence: data?.analysis_confidence ?? null,
      summary: preview(data?.summary ?? null),
      transcript_length: data?.transcript_text ? String(data.transcript_text).length : 0,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});


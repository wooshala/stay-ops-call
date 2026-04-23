/**
 * Export batch job calls to JSON with specified fields.
 *
 * Usage:
 *   node .artifacts/export-batch-job-results.mjs <JOB_ID> <OUT_PATH>
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

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

async function main() {
  const jobId = process.argv[2];
  const outPath = process.argv[3];
  if (!jobId || !outPath) {
    console.error("Usage: node .artifacts/export-batch-job-results.mjs <JOB_ID> <OUT_PATH>");
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

  const { data: calls, error } = await supabase
    .from("calls")
    .select(
      "id,source_file_name,primary_intent,analysis_status,workflow_status,workflow_error_code,workflow_error_message,analysis_confidence,summary",
    )
    .eq("batch_job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("DB error", error);
    process.exit(2);
  }

  const rows =
    (calls ?? []).map((c) => ({
      call_id: c.id ?? null,
      file_name: c.source_file_name ?? null,
      primary_intent: c.primary_intent ?? null,
      analysis_status: c.analysis_status ?? null,
      workflow_status: c.workflow_status ?? null,
      workflow_error_code: c.workflow_error_code ?? null,
      workflow_error_message: c.workflow_error_message ?? null,
      analysis_confidence: c.analysis_confidence ?? null,
      summary: c.summary ?? null,
    })) ?? [];

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`wrote ${rows.length} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});


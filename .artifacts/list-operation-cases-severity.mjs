/**
 * List distinct severity values present in operation_cases.
 *
 * Usage:
 *   node .artifacts/list-operation-cases-severity.mjs
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

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabase.from("operation_cases").select("severity,status,channel_type").limit(500);
  if (error) throw error;

  const distinct_severity = Array.from(new Set((data ?? []).map((x) => x.severity).filter(Boolean))).sort();
  const distinct_status = Array.from(new Set((data ?? []).map((x) => x.status).filter(Boolean))).sort();
  const distinct_channel_type = Array.from(new Set((data ?? []).map((x) => x.channel_type).filter(Boolean))).sort();
  console.log(
    JSON.stringify(
      { distinct_severity, distinct_status, distinct_channel_type, sample_count: (data ?? []).length },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});


/**
 * Minimal DB test: update calls.summary only, then restore.
 *
 * Usage:
 *   node .artifacts/test-summary-only-update.mjs <CALL_ID>
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

async function main() {
  const callId = process.argv[2];
  if (!callId) {
    console.error("Usage: node .artifacts/test-summary-only-update.mjs <CALL_ID>");
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

  const before = await supabase
    .from("calls")
    .select("id,summary,updated_at")
    .eq("id", callId)
    .maybeSingle();
  if (before.error) throw before.error;
  if (!before.data) {
    console.error("Call not found", callId);
    process.exit(2);
  }

  const original = before.data.summary ?? null;
  const testValue = `debug summary test ${new Date().toISOString()}`;

  console.log("== before ==");
  console.log({ id: before.data.id, summary: original, updated_at: before.data.updated_at ?? null });

  const upd = await supabase
    .from("calls")
    .update({ summary: testValue })
    .eq("id", callId);
  if (upd.error) throw upd.error;

  const mid = await supabase
    .from("calls")
    .select("id,summary,updated_at")
    .eq("id", callId)
    .maybeSingle();
  if (mid.error) throw mid.error;

  console.log("== after update ==");
  console.log({ id: mid.data?.id ?? null, summary: mid.data?.summary ?? null, updated_at: mid.data?.updated_at ?? null });

  const restore = await supabase
    .from("calls")
    .update({ summary: original })
    .eq("id", callId);
  if (restore.error) throw restore.error;

  const end = await supabase
    .from("calls")
    .select("id,summary,updated_at")
    .eq("id", callId)
    .maybeSingle();
  if (end.error) throw end.error;

  console.log("== after restore ==");
  console.log({ id: end.data?.id ?? null, summary: end.data?.summary ?? null, updated_at: end.data?.updated_at ?? null });
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});


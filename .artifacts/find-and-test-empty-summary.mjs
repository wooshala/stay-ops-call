/**
 * Find calls with empty summary + non-empty transcript, then:
 * - call local POST /api/calls/{id}/analyze
 * - re-read DB calls.summary immediately
 * - classify results
 *
 * Usage:
 *   node .artifacts/find-and-test-empty-summary.mjs [baseUrl]
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

function preview(s, n = 120) {
  if (s == null) return null;
  const str = String(s);
  return str.length > n ? `${str.slice(0, n)}…[truncated:${str.length}]` : str;
}

function internalApiJsonHeaders(env) {
  const headers = { "Content-Type": "application/json" };
  const t = env.INTERNAL_API_TOKEN?.trim();
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

async function readCall(supabase, id) {
  const { data, error } = await supabase
    .from("calls")
    .select("id,created_at,analysis_status,summary,transcript_text,primary_intent,analysis_error_code,analysis_error_message")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  const baseUrl = process.argv[2] || "http://localhost:3000";
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

  console.log("== finding candidates (summary empty + transcript non-empty) ==");
  const { data: rows, error } = await supabase
    .from("calls")
    .select("id,created_at,summary,transcript_text")
    .or("summary.is.null,summary.eq.")
    .not("transcript_text", "is", null)
    .neq("transcript_text", "")
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) {
    console.error("query error", error);
    process.exit(2);
  }
  const candidates = rows ?? [];
  if (candidates.length === 0) {
    console.log("(no candidates found)");
    return;
  }

  for (const c of candidates) {
    const id = c.id;
    const txLen = c.transcript_text ? String(c.transcript_text).length : 0;
    console.log("-", { id, created_at: c.created_at, transcriptLength: txLen });
  }

  const results = [];
  for (const c of candidates) {
    const id = c.id;
    const before = await readCall(supabase, id);
    const beforeEmpty = !before?.summary || String(before.summary).trim() === "";

    console.log("\n== analyze ==", id);
    const res = await fetch(`${baseUrl}/api/calls/${id}/analyze`, {
      method: "POST",
      headers: internalApiJsonHeaders(env),
      body: "{}",
    });
    const json = await res.json().catch(() => ({}));

    const after = await readCall(supabase, id);
    const afterEmpty = !after?.summary || String(after.summary).trim() === "";

    let bucket = "500_or_other";
    if (res.status === 200 && !afterEmpty) bucket = "200_filled";
    else if (res.status === 200 && afterEmpty) bucket = "200_still_empty";

    results.push({
      id,
      before_empty: beforeEmpty,
      before_status: before?.analysis_status ?? null,
      after_status: after?.analysis_status ?? null,
      http: res.status,
      bucket,
      response_summary_preview: preview(json?.analysis?.summary ?? null),
      db_summary_preview: preview(after?.summary ?? null),
      analysis_error_code: after?.analysis_error_code ?? null,
      analysis_error_message_preview: preview(after?.analysis_error_message ?? null),
    });
  }

  console.log("\n== classified results ==");
  for (const r of results) {
    console.log(r);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});


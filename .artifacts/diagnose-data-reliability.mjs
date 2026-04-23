/**
 * One-off: load .env.local, query Supabase for calls inflow + batch pipeline context.
 * Run: node .artifacts/diagnose-data-reliability.mjs
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

function dayKey(iso) {
  if (!iso) return "unknown";
  return String(iso).slice(0, 10);
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env / .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const sinceIso = twoWeeksAgo.toISOString();
  /** Also report last 45 days so March batches are visible when "today" is April. */
  const fortyFiveAgo = new Date();
  fortyFiveAgo.setDate(fortyFiveAgo.getDate() - 45);
  const since45Iso = fortyFiveAgo.toISOString();

  const { data: recentCalls, error: e1 } = await supabase
    .from("calls")
    .select("id, created_at, source_file_name, analysis_status, primary_intent, batch_job_id, stt_status")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (e1) {
    console.error("calls recent query error", e1);
    process.exit(1);
  }

  const { data: recent45 } = await supabase
    .from("calls")
    .select("id, created_at")
    .gte("created_at", since45Iso)
    .order("created_at", { ascending: false })
    .limit(5000);

  const byDay = new Map();
  for (const r of recentCalls ?? []) {
    const d = dayKey(r.created_at);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  const byDay45 = new Map();
  for (const r of recent45 ?? []) {
    const d = dayKey(r.created_at);
    byDay45.set(d, (byDay45.get(d) ?? 0) + 1);
  }

  const { count: totalAll, error: eCount } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true });
  if (eCount) console.warn("count error", eCount);

  const { data: last5names } = await supabase
    .from("calls")
    .select("created_at, source_file_name")
    .not("source_file_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(15);

  const { data: jobsMar23, error: ej } = await supabase
    .from("batch_jobs")
    .select("id, name, pipeline, status, created_at, finished_at, total_count, success_count, failed_count")
    .gte("created_at", "2026-03-22T00:00:00Z")
    .lte("created_at", "2026-03-24T23:59:59Z")
    .order("created_at", { ascending: true });

  if (ej) console.warn("batch_jobs range query", ej);

  const { data: completedNullIntent } = await supabase
    .from("calls")
    .select("id, created_at, analysis_status, primary_intent, batch_job_id")
    .eq("analysis_status", "completed")
    .is("primary_intent", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const sampleIds = (completedNullIntent ?? []).slice(0, 5).map((r) => r.id);
  const entityCounts = {};
  for (const id of sampleIds) {
    const { data: ents, error: ee } = await supabase
      .from("call_entities")
      .select("id")
      .eq("call_id", id);
    if (!ee) entityCounts[id] = (ents ?? []).length;
  }

  const pipelineForBatch = {};
  for (const row of completedNullIntent ?? []) {
    const bid = row.batch_job_id;
    if (!bid) continue;
    if (pipelineForBatch[bid]) continue;
    const { data: job } = await supabase
      .from("batch_jobs")
      .select("id, pipeline, name, created_at")
      .eq("id", bid)
      .maybeSingle();
    pipelineForBatch[bid] = job ?? null;
  }

  console.log("=== DIAGNOSIS: data reliability ===\n");
  console.log("Total calls (estimate):", totalAll ?? "(n/a)");
  console.log("\n--- Last 14 days: calls created_at counts by day (up to 2000 rows sampled) ---");
  console.log([...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, n]) => `${d}: ${n}`).join("\n") || "(no rows in 14d window)");
  console.log("\n--- Last 45 days: calls created_at counts by day (up to 5000 rows) ---");
  console.log([...byDay45.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, n]) => `${d}: ${n}`).join("\n") || "(no rows)");
  console.log("\n--- Recent rows with source_file_name (latest 15) ---");
  for (const r of last5names ?? []) {
    console.log(`${r.created_at?.slice(0, 19)}  ${r.source_file_name}`);
  }

  console.log("\n--- batch_jobs on/around 2026-03-23 ---");
  if (!jobsMar23?.length) {
    console.log("(none in range — check timezone or naming)");
  } else {
    for (const j of jobsMar23) {
      console.log(
        `${j.created_at?.slice(0, 19)}  pipeline=${j.pipeline}  status=${j.status}  total=${j.total_count}  ok=${j.success_count}  fail=${j.failed_count}  ${j.name ?? ""}`,
      );
    }
  }

  console.log("\n--- calls: analysis_status=completed AND primary_intent IS NULL (latest 30) ---");
  for (const r of completedNullIntent ?? []) {
    const entN = entityCounts[r.id];
    const job = r.batch_job_id ? pipelineForBatch[r.batch_job_id] : null;
    console.log(
      `${r.id.slice(0, 8)}…  created=${r.created_at?.slice(0, 10)}  batch=${r.batch_job_id ? r.batch_job_id.slice(0, 8) + "…" : "-"}  pipeline=${job?.pipeline ?? "?"}  entities=${entN ?? "?"}`,
    );
  }

  const firstBad = (completedNullIntent ?? [])[0];
  if (firstBad?.id) {
    const { data: detail, error: detailErr } = await supabase
      .from("calls")
      .select("id, summary, primary_intent, analysis_status, analysis_error_code, transcript_text, stt_status")
      .eq("id", firstBad.id)
      .maybeSingle();
    console.log("\n--- Sample row (first completed + null primary_intent) ---");
    if (detailErr) console.log("detail query error:", detailErr);
    if (detail) {
      console.log({
        id: detail.id,
        summary: detail.summary ? `${String(detail.summary).slice(0, 80)}…` : null,
        primary_intent: detail.primary_intent,
        analysis_status: detail.analysis_status,
        analysis_error_code: detail.analysis_error_code,
        stt_status: detail.stt_status,
        transcript_len: detail.transcript_text ? String(detail.transcript_text).length : 0,
      });
    } else if (!detailErr) {
      console.log("(no row returned for id)", firstBad.id);
    }
    if (detail?.id && !detailErr) {
      const { data: ent } = await supabase
        .from("call_entities")
        .select("checkin_date, occupancy_count, extracted_json")
        .eq("call_id", detail.id)
        .limit(1);
      console.log("call_entities sample:", ent?.[0] ?? null);
    }
  } else {
    console.log("\n--- Sample row: none (no completed+null intent rows) ---");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

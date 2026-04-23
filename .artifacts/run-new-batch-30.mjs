/**
 * Create and run a NEW batch job (30 files) from batch-test fixtures,
 * excluding files already used by a given previous batch_job_id.
 *
 * Usage:
 *   node .artifacts/run-new-batch-30.mjs <EXCLUDE_JOB_ID> [baseUrl]
 *
 * Outputs:
 * - prints new job_id and chosen file list
 *
 * Requires:
 * - dev server running at baseUrl (default http://localhost:3000)
 * - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const excludeJobId = process.argv[2];
  const baseUrl = process.argv[3] || "http://localhost:3000";
  if (!excludeJobId) {
    console.error("Usage: node .artifacts/run-new-batch-30.mjs <EXCLUDE_JOB_ID> [baseUrl]");
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

  // 1) files used in excluded batch
  const { data: usedCalls, error: usedErr } = await supabase
    .from("calls")
    .select("source_file_name")
    .eq("batch_job_id", excludeJobId);
  if (usedErr) throw usedErr;
  const used = new Set(
    (usedCalls ?? [])
      .map((r) => (r.source_file_name ?? "").trim())
      .filter(Boolean),
  );

  // 2) list all fixtures
  const filesRes = await fetch(`${baseUrl}/api/batch-test/files`);
  const filesJson = await filesRes.json();
  if (!filesRes.ok) {
    throw new Error(`failed to list fixtures: ${filesRes.status} ${filesJson?.error ?? ""}`);
  }
  const all = Array.isArray(filesJson.files)
    ? filesJson.files
        .map((x) => (x && typeof x === "object" ? x.name : x))
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    : [];

  const eligible = all.filter((f) => !used.has(String(f).trim()));
  if (eligible.length < 30) {
    throw new Error(`Not enough eligible fixtures. eligible=${eligible.length}, used=${used.size}, all=${all.length}`);
  }

  // Best-effort diversity: spread selection across the list (deterministic stride).
  const chosen = [];
  const stride = Math.max(1, Math.floor(eligible.length / 30));
  for (let i = 0; i < eligible.length && chosen.length < 30; i += stride) {
    chosen.push(eligible[i]);
  }
  while (chosen.length < 30) chosen.push(eligible[chosen.length]);

  // 3) create batch job via /api/batch-test/run
  const runRes = await fetch(`${baseUrl}/api/batch-test/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: chosen,
      pipeline: "full",
      name: `NEW-30 ${new Date().toISOString().slice(0, 10)}`,
    }),
  });
  const runJson = await runRes.json();
  if (!runRes.ok) {
    throw new Error(`batch-test/run failed: ${runRes.status} ${runJson?.error ?? ""}`);
  }
  const jobId = runJson.job_id;
  if (!jobId) throw new Error("job_id missing from /api/batch-test/run response");

  // 4) start job
  const startRes = await fetch(`${baseUrl}/api/batch-test/jobs/${jobId}/start`, { method: "POST" });
  const startJson = await startRes.json().catch(() => ({}));
  if (!startRes.ok) throw new Error(`start failed: ${startRes.status} ${startJson?.error ?? ""}`);
  if (startJson.accepted !== true) {
    throw new Error(`start not accepted: ${JSON.stringify(startJson)}`);
  }

  // 5) poll job status
  console.log("job_id:", jobId);
  console.log("chosen_files:", chosen);
  console.log("polling...");

  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const stRes = await fetch(`${baseUrl}/api/batch-test/jobs/${jobId}`);
    const stJson = await stRes.json().catch(() => ({}));
    if (!stRes.ok) {
      console.log("status error", stRes.status, stJson?.error ?? "");
      continue;
    }
    const status = stJson?.job?.status ?? stJson?.status ?? null;
    const processed = stJson?.job?.processed_count ?? stJson?.processed_count ?? null;
    const total = stJson?.job?.total_count ?? stJson?.total_count ?? null;
    console.log("status:", status, "processed:", processed, "/", total);
    if (status === "completed" || status === "failed") {
      console.log("done:", status);
      return;
    }
  }

  throw new Error("timeout polling batch job");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});


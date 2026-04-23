/**
 * 배치 내 전체 통화를 재분석 (analyze API 호출)
 * 새 프롬프트 + heuristics 적용 결과 측정용
 */
const http = require("http");
const { createClient } = require("@supabase/supabase-js");

const JOB_ID = process.argv[2] || "0456c50d-4c06-47c1-8e42-8380d0f25401";
const CONCURRENCY = 1; // sequential to avoid rate limits
const DELAY_MS = 800;

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }
const supabase = createClient(
  process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function internalAnalyzeHeaders(body) {
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function analyzeCall(callId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({});
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path: `/api/calls/${callId}/analyze`,
        method: "POST",
        headers: internalAnalyzeHeaders(body),
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(d) });
          } catch {
            resolve({ status: res.statusCode, data: {} });
          }
        });
      },
    );
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(45000, () => {
      req.destroy();
      resolve({ status: 0, error: "timeout" });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id,source_file_name,primary_intent,analysis_confidence")
    .eq("batch_job_id", JOB_ID)
    .order("created_at", { ascending: true });

  if (error) { console.error("DB error:", error.message); process.exit(1); }

  console.log(`Reprocessing ${calls.length} calls in job ${JOB_ID}`);
  console.log("=".repeat(60));

  const results = [];
  let ok = 0, fail = 0;

  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    const label = c.source_file_name?.slice(0, 32) ?? c.id.slice(0, 8);
    process.stdout.write(`[${i + 1}/${calls.length}] ${label} ... `);

    const res = await analyzeCall(c.id);

    if (res.status === 200 && res.data?.analysis) {
      const a = res.data.analysis;
      const wf = res.data.workflow;
      const changed = a.primary_intent !== c.primary_intent;
      console.log(
        `OK intent=${a.primary_intent}${changed ? ` (was:${c.primary_intent})` : ""} conf=${a.confidence?.toFixed(2)} wf=${wf?.createdType ?? "skipped"}`,
      );
      results.push({ id: c.id, file: c.source_file_name, ok: true, before_intent: c.primary_intent, after_intent: a.primary_intent, confidence: a.confidence, summary: a.summary, wf_type: wf?.createdType ?? null });
      ok++;
    } else {
      console.log(`FAIL status=${res.status} ${res.error || JSON.stringify(res.data).slice(0, 80)}`);
      results.push({ id: c.id, file: c.source_file_name, ok: false, before_intent: c.primary_intent });
      fail++;
    }

    if (i < calls.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("=".repeat(60));
  console.log(`Done: ${ok} ok / ${fail} fail`);

  const fs = require("fs");
  const path = require("path");
  const outDir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "reprocess_intermediate.json");
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`Intermediate results: ${outFile}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

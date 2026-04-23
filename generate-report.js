const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const reportsDir = path.join(__dirname, "reports");
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

const lines = [];
function log(msg = "") {
  console.log(msg);
  lines.push(msg);
}

async function generateReport() {
  const jobId = "0456c50d-4c06-47c1-8e42-8380d0f25401";

  try {
    // Get job status
    const { data: job, error: jobErr } = await supabase
      .from("batch_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr) throw jobErr;

    log("=== BATCH JOB STATUS ===");
    log(`ID: ${job.id}`);
    log(`Status: ${job.status}`);
    log(`Processed: ${job.processed_count}/${job.total_count}`);
    log(`Success: ${job.success_count}`);
    log(`Failed: ${job.failed_count}`);
    log(`Started: ${job.started_at}`);
    log(`Finished: ${job.finished_at}`);
    if (job.error_message) log(`Error: ${job.error_message}`);

    // Get all calls
    const { data: calls, error: callErr } = await supabase
      .from("calls")
      .select(
        "id, source_file_name, phone_number, analysis_status, primary_intent, analysis_confidence, summary, stt_status, stt_error_message, analysis_error_message, analysis_error_code, workflow_status, workflow_error_code, workflow_error_message, workflow_completed_at",
      )
      .eq("batch_job_id", jobId)
      .order("created_at", { ascending: false });

    if (callErr) throw callErr;

    log("\n=== RESULTS SUMMARY ===");
    const statusCounts = {};
    calls.forEach((c) => {
      const s = c.analysis_status;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    log(JSON.stringify(statusCounts, null, 2));

    log("\n=== SUCCESS CASES (first 5) ===");
    const successes = calls.filter((c) => c.analysis_status === "completed");
    successes.slice(0, 5).forEach((c, i) => {
      log(`${i + 1}. ${c.source_file_name}`);
      log(`   Intent: ${c.primary_intent} (${c.analysis_confidence})`);
      log(`   Summary: ${c.summary?.substring(0, 80)}...`);
    });

    log("\n=== FAILURES ===");
    const failures = calls.filter((c) => c.analysis_status === "failed");
    const failureTypes = {};
    failures.forEach((c) => {
      const code = c.analysis_error_code || "unknown";
      if (!failureTypes[code]) {
        failureTypes[code] = { count: 0, example: c.analysis_error_message };
      }
      failureTypes[code].count += 1;
    });
    log(JSON.stringify(failureTypes, null, 2));

    log("\n=== WORKFLOW STATUS ===");
    const wfCounts = {};
    calls.forEach((c) => {
      const s = c.workflow_status || "null";
      wfCounts[s] = (wfCounts[s] || 0) + 1;
    });
    log(JSON.stringify(wfCounts, null, 2));

    log("\n=== WORKFLOW FAILURES ===");
    const wfFailures = calls.filter((c) => c.workflow_status === "failed");
    wfFailures.forEach((c) => {
      log(`  ${c.source_file_name}: [${c.workflow_error_code}] ${c.workflow_error_message}`);
    });

    log("\n=== INTENT DISTRIBUTION (among successes) ===");
    const intents = {};
    successes.forEach((c) => {
      const i = c.primary_intent || "unknown";
      intents[i] = (intents[i] || 0) + 1;
    });
    log(JSON.stringify(intents, null, 2));

    log("\n=== CONFIDENCE STATS (successes) ===");
    const confidences = successes
      .map((c) => c.analysis_confidence)
      .filter((c) => c != null);
    if (confidences.length > 0) {
      const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const min = Math.min(...confidences);
      const max = Math.max(...confidences);
      log(`Average: ${avg.toFixed(2)}`);
      log(`Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = path.join(reportsDir, `batch-report-${timestamp}.txt`);
    fs.writeFileSync(filename, lines.join("\n"), "utf8");
    console.log(`\n✅ 보고서 저장됨: reports/batch-report-${timestamp}.txt`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

generateReport();

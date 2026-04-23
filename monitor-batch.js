const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkProgress() {
  const jobId = "0456c50d-4c06-47c1-8e42-8380d0f25401";

  // Get job status
  const { data: job, error: jobErr } = await supabase
    .from("batch_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr) return console.error("Job error:", jobErr);

  console.log(`\n[${new Date().toISOString()}]`);
  console.log(`Status: ${job.status} (${job.processed_count}/${job.total_count})`);
  console.log(`Success: ${job.success_count}, Failed: ${job.failed_count}`);

  // Get calls stats
  const { data: calls, error: callErr } = await supabase
    .from("calls")
    .select("analysis_status, analysis_error_message")
    .eq("batch_job_id", jobId);

  if (!callErr && calls) {
    const stats = {
      queued: calls.filter((c) => c.analysis_status === "queued").length,
      processing: calls.filter((c) => c.analysis_status === "processing").length,
      completed: calls.filter((c) => c.analysis_status === "completed").length,
      partial: calls.filter((c) => c.analysis_status === "partial").length,
      warning: calls.filter((c) => c.analysis_status === "warning").length,
      failed: calls.filter((c) => c.analysis_status === "failed").length,
    };
    console.log(`Calls created: ${calls.length}`);
    console.log(`  Queued: ${stats.queued}, Processing: ${stats.processing}`);
    console.log(`  Completed: ${stats.completed}, Partial: ${stats.partial}`);
    console.log(`  Warning: ${stats.warning}, Failed: ${stats.failed}`);

    // Show first failure if any
    const failed = calls.find(
      (c) => c.analysis_status === "failed" && c.analysis_error_message,
    );
    if (failed) {
      console.log(`First failure: ${failed.analysis_error_message}`);
    }
  }
}

// Check immediately and then every 30 seconds
checkProgress();
const interval = setInterval(checkProgress, 30000);

// Auto-stop when job completes
setTimeout(() => {
  clearInterval(interval);
  console.log("\nMonitoring stopped (timeout)");
  process.exit(0);
}, 600000); // 10 minutes

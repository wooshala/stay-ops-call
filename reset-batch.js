const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  try {
    const oldJobId = "b04809e6-69f0-41ed-91f8-7da601cf0aaa";

    // Mark old batch job as failed
    console.log("Marking old batch job as failed...");
    const { error: updateErr } = await supabase
      .from("batch_jobs")
      .update({
        status: "failed",
        error_message: "Replaced by new batch run (fix deployed)",
      })
      .eq("id", oldJobId);

    if (updateErr) {
      console.error("Failed to update old batch:", updateErr);
    } else {
      console.log("Old batch marked as failed");
    }

    // The 30 test files
    const files = [
      "010-2071-8192_250615_135457.m4a",
      "010-2101-6888_251122_103522.m4a",
      "010-2269-0036_250810_212852.m4a",
      "010-2443-6469_251029_153506.m4a",
      "010-2700-7823_251130_135018.m4a",
      "010-2803-8412_250523_124144.m4a",
      "010-3003-8732_260307_034552.m4a",
      "010-3243-3639_251202_021024.m4a",
      "010-3263-6566_251005_091650.m4a",
      "010-3733-3985_250910_205308.m4a",
      "010-3916-1131_251201_152455.m4a",
      "010-4152-6577_251221_002012.m4a",
      "010-4767-4742_250905_051136.m4a",
      "010-4893-3329_250926_112415.m4a",
      "010-5192-1170_250827_204923.m4a",
      "010-5238-1192_260112_211146.m4a",
      "010-5322-4028_251028_085749.m4a",
      "010-5497-8218_251106_145535.m4a",
      "010-7435-5358_251022_093223.m4a",
      "010-7557-8081_260131_162920.m4a",
      "010-7697-5863_250618_145053.m4a",
      "010-7924-9068_260319_000348.m4a",
      "010-8456-1038_251029_161411.m4a",
      "010-8716-1503_260117_005707.m4a",
      "010-8854-7374_251210_023118.m4a",
      "010-8969-8381_251022_130557.m4a",
      "010-9417-5127_260108_195534.m4a",
      "010-9456-5122_251117_235247.m4a",
      "010-9580-6199_250809_144628.m4a",
      "010-9957-2475_251205_023331.m4a",
    ];

    // Create new batch job via API
    console.log("\nCreating new batch job with 30 files...");
    const response = await fetch("http://localhost:3000/api/batch-test/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files,
        pipeline: "full",
        name: "P1 검증 배치 30건 (수정됨)",
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error("Failed to create batch:", result);
      return;
    }

    console.log("New batch created:", result.job_id);
    console.log("Total count:", result.total_count);

    // Start the batch job
    console.log("\nStarting batch job...");
    const startResponse = await fetch(
      `http://localhost:3000/api/batch-test/jobs/${result.job_id}/start`,
      { method: "POST" },
    );

    const startResult = await startResponse.json();
    if (!startResult.ok) {
      console.error("Failed to start batch:", startResult);
      return;
    }

    console.log("Batch job started!");
    console.log("Watch progress at:");
    console.log(
      `  http://localhost:3000/api/batch-test/jobs/${result.job_id}`,
    );
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();

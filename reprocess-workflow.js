/**
 * workflow_status = 'failed' | 'not_started' 인 completed 통화를 재처리
 * (analysis_status = completed 이지만 workflow가 아직 안 만들어진 건)
 *
 * 사용법:
 *   node reprocess-workflow.js                  # 전체 재처리 대상 확인
 *   node reprocess-workflow.js --dry-run        # 대상만 출력, 실행 안 함
 *   node reprocess-workflow.js --job <JOB_ID>   # 특정 배치만
 *   node reprocess-workflow.js --limit 5        # 최대 5건
 */

const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }
const API_BASE = "http://localhost:3000";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const JOB_IDX = args.indexOf("--job");
const JOB_ID = JOB_IDX >= 0 ? args[JOB_IDX + 1] : null;
const LIMIT_IDX = args.indexOf("--limit");
const LIMIT = LIMIT_IDX >= 0 ? parseInt(args[LIMIT_IDX + 1], 10) : 50;

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function callAnalyzeAPI(callId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const req = require("http").request(
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
            resolve({ status: res.statusCode, body: JSON.parse(d) });
          } catch {
            resolve({ status: res.statusCode, body: d });
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("=== Workflow 재처리 스크립트 ===");
  console.log(`DRY_RUN: ${DRY_RUN}, JOB: ${JOB_ID ?? "all"}, LIMIT: ${LIMIT}`);

  let query = supabase
    .from("calls")
    .select("id,source_file_name,primary_intent,analysis_confidence,workflow_status,workflow_error_code")
    .eq("analysis_status", "completed")
    .in("workflow_status", ["not_started", "failed"])
    .order("created_at", { ascending: true })
    .limit(LIMIT);

  if (JOB_ID) {
    query = query.eq("batch_job_id", JOB_ID);
  }

  const { data: targets, error } = await query;
  if (error) {
    console.error("DB 오류:", error.message);
    process.exit(1);
  }

  console.log(`\n재처리 대상: ${targets.length}건`);
  targets.forEach((t, i) => {
    const policy = t.analysis_confidence >= 0.7 ? "normal" : t.analysis_confidence >= 0.3 ? "needs_review" : "low_conf";
    console.log(
      `${i + 1}. ${t.source_file_name?.slice(0, 30)} | intent:${t.primary_intent} | wf:${t.workflow_status} | conf:${t.analysis_confidence} | ${policy}`,
    );
  });

  if (DRY_RUN || targets.length === 0) {
    console.log("\n--dry-run 모드. 종료.");
    return;
  }

  console.log("\n재처리 시작...");
  let ok = 0, fail = 0;

  for (const t of targets) {
    process.stdout.write(`  처리 중: ${t.source_file_name?.slice(0, 30)} ... `);
    try {
      const res = await callAnalyzeAPI(t.id);
      if (res.status === 200) {
        const wf = res.body?.workflow;
        console.log(`OK (workflow: ${wf?.createdType ?? "skipped"})`);
        ok++;
      } else {
        console.log(`FAIL (HTTP ${res.status})`);
        fail++;
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      fail++;
    }
    // 속도 제한
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n완료: 성공 ${ok}건 / 실패 ${fail}건`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectTable() {
  console.log("🔍 operation_cases 테이블 과 기존 데이터 검사\n");

  // 1. 기존 operation_cases 행 조회
  const { data: existing, error: existErr } = await supabase
    .from("operation_cases")
    .select("*")
    .limit(1);

  if (existErr) {
    console.error("❌ Query failed:", existErr);
    return;
  }

  console.log(`총 operation_cases 레코드: 0 이상\n`);

  if (existing && existing.length > 0) {
    const row = existing[0];
    console.log("첫 번째 행의 컬럼들:");
    Object.keys(row).forEach((key) => {
      console.log(`  ${key}: ${typeof row[key]}`);
    });
  }

  // 2. RLS 정책 확인
  console.log("\n📋 Workflow 테이블들의 제약 조건 확인:\n");

  const tables = ["operation_cases", "service_requests", "reservation_leads"];

  for (const table of tables) {
    console.log(`📌 ${table}:`);

    // 테이블 정보 조회 (직접 upsert 시도로 에러 수집)
    try {
      const { error } = await supabase
        .from(table)
        .upsert(
          {
            call_id: "00000000-0000-0000-0000-000000000000",
            title: "test",
          },
          { onConflict: "call_id" }
        )
        .select("*")
        .single();

      if (error) {
        console.log(`  Error Code: ${error.code}`);
        console.log(`  Message: ${error.message}`);
        if (error.details) console.log(`  Details: ${error.details}`);
      }
    } catch (e) {
      console.log(`  Exception: ${e.message}`);
    }
  }

  // 3. operation_cases의 기존 행에서 case_type, confidence 등의 값 확인
  console.log("\n🔎 operation_cases 기존 데이터 샘플");

  const { data: allOps } = await supabase
    .from("operation_cases")
    .select("id, call_id, case_type, severity, title");

  if (allOps && allOps.length > 0) {
    console.log(`${allOps.length}건 중 5건 샘플:`);
    allOps.slice(0, 5).forEach((row, idx) => {
      console.log(
        `  [${idx + 1}] case_type="${row.case_type}" severity="${row.severity}"`
      );
    });

    // case_type 값 분포
    const caseTypes = {};
    allOps.forEach((row) => {
      caseTypes[row.case_type] = (caseTypes[row.case_type] || 0) + 1;
    });

    console.log(
      `\n  case_type 분포: ${JSON.stringify(caseTypes)}`
    );
  } else {
    console.log("  (비어있음)");
  }
}

inspectTable().catch(console.error);

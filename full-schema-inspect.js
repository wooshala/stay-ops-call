const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function inspectAllTables() {
  console.log("🔍 모든 Workflow 테이블 스키마 조사\n");

  const tables = {
    operation_cases: {},
    service_requests: {},
    reservation_leads: {},
  };

  for (const [tableName, _] of Object.entries(tables)) {
    console.log(`📋 ${tableName}:`);

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .limit(1);

    if (error) {
      console.error(`  Error: ${error.message}`);
      continue;
    }

    if (data && data.length > 0) {
      const keys = Object.keys(data[0]);
      console.log(`  컬럼 (${keys.length}개):`);
      keys.forEach((k) => {
        const val = data[0][k];
        const type = typeof val;
        const display = `${k}: ${type}`;
        console.log(`    ${display}`);
      });
    } else {
      console.log("  (데이터 없음 - 구조를 알 수 없음)");
    }
    console.log();
  }
}

inspectAllTables().catch(console.error);

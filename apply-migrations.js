/**
 * Migration 031 + 032 적용 스크립트
 * Supabase Dashboard SQL Editor에서 직접 실행하거나
 * `npx supabase db push` (CLI 로그인 필요) 사용
 *
 * 사용법: node apply-migrations.js
 * 필요: SUPABASE_ACCESS_TOKEN 환경변수 또는 `npx supabase login`
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const PROJECT_REF = "zraynckvincilfbekbld";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("❌ SUPABASE_ACCESS_TOKEN 환경변수가 필요합니다.");
  console.error("");
  console.error("방법 1: Supabase Dashboard SQL Editor에서 직접 실행");
  console.error("  - https://supabase.com/dashboard/project/zraynckvincilfbekbld/editor");
  console.error("  - 아래 SQL 파일 내용을 순서대로 실행:");
  console.error("    1. supabase/migrations/031_workflow_status_columns.sql");
  console.error("    2. supabase/migrations/032_intent_taxonomy_backfill.sql");
  console.error("");
  console.error("방법 2: CLI 사용");
  console.error("  npx supabase login");
  console.error("  SUPABASE_ACCESS_TOKEN=<token> node apply-migrations.js");

  console.error("\n--- 031 SQL 내용 ---");
  console.error(fs.readFileSync("./supabase/migrations/031_workflow_status_columns.sql", "utf8"));
  console.error("\n--- 032 SQL 내용 ---");
  console.error(fs.readFileSync("./supabase/migrations/032_intent_taxonomy_backfill.sql", "utf8"));
  process.exit(1);
}

async function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request(
      {
        hostname: "api.supabase.com",
        path: `/v1/projects/${PROJECT_REF}/database/query`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(d));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${d}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const migrations = [
    "031_workflow_status_columns.sql",
    "032_intent_taxonomy_backfill.sql",
  ];

  for (const file of migrations) {
    const sql = fs.readFileSync(
      path.join("supabase", "migrations", file),
      "utf8",
    );
    console.log(`⏳ Applying ${file}...`);
    try {
      await runQuery(sql);
      console.log(`✅ ${file} applied`);
    } catch (e) {
      console.error(`❌ ${file} failed:`, e.message);
      process.exit(1);
    }
  }
  console.log("\n🎉 모든 migration 적용 완료");
}

main();

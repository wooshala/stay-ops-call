/**
 * 교정 패턴 분석 스크립트
 * correction_events VIEW를 집계해 오분류 패턴 리포트를 생성한다.
 *
 * 사용법:
 *   node scripts/analyze-corrections.js              # 최근 90일
 *   node scripts/analyze-corrections.js --days 30    # 최근 30일
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zraynckvincilfbekbld.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다"); process.exit(1); }

const args = process.argv.slice(2);
const DAYS_IDX = args.indexOf("--days");
const DAYS = DAYS_IDX >= 0 ? parseInt(args[DAYS_IDX + 1], 10) : 90;
const THRESHOLD_WARN = 5;
const THRESHOLD_CRITICAL = 10;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function countBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function flag(count) {
  if (count >= THRESHOLD_CRITICAL) return "🔴";
  if (count >= THRESHOLD_WARN) return "🟡";
  return "  ";
}

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("correction_events")
    .select("*")
    .gte("reviewed_at", since);

  if (error) {
    console.error("DB 오류:", error.message);
    process.exit(1);
  }

  const total = events.length;
  const intentChanged = events.filter((e) => e.intent_changed);
  const summaryChanged = events.filter((e) => e.summary_changed);
  const shouldCreateMissed = events.filter(
    (e) => e.final_should_create_record === true && e.original_intent !== e.corrected_intent,
  );
  const followupNeeded = events.filter((e) => e.final_requires_followup === true);

  // 버전별 오류율
  const byPromptVersion = countBy(intentChanged, (e) => e.prompt_version ?? "unknown");
  const byHeuristicVersion = countBy(intentChanged, (e) => e.heuristic_version ?? "unknown");

  // confidence 구간별 오류율
  const confBuckets = { low: 0, mid: 0, high: 0, total_low: 0, total_mid: 0, total_high: 0 };
  for (const e of events) {
    const c = e.original_confidence ?? 0;
    if (c < 0.3) {
      confBuckets.total_low++;
      if (e.intent_changed) confBuckets.low++;
    } else if (c < 0.7) {
      confBuckets.total_mid++;
      if (e.intent_changed) confBuckets.mid++;
    } else {
      confBuckets.total_high++;
      if (e.intent_changed) confBuckets.high++;
    }
  }

  const pct = (n, d) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(0)}%`);

  const lines = [];
  lines.push(`Pattern Report (최근 ${DAYS}일 | ${new Date().toISOString().slice(0, 10)})`);
  lines.push("═".repeat(60));
  lines.push(`총 검수 건: ${total}건 | Intent 교정: ${intentChanged.length}건 | Summary 교정: ${summaryChanged.length}건`);
  lines.push("");

  lines.push("── Intent 오분류 패턴 ──────────────────────────────────────");
  if (intentChanged.length === 0) {
    lines.push("  (데이터 없음)");
  } else {
    const patterns = countBy(intentChanged, (e) => `${e.original_intent} → ${e.corrected_intent}`);
    for (const [pattern, count] of patterns) {
      const f = flag(count);
      const note = count >= THRESHOLD_CRITICAL ? " ← 개선 권장" : count >= THRESHOLD_WARN ? " ← 모니터링" : "";
      lines.push(`  ${f} ${pattern.padEnd(45)} ${count}회${note}`);
    }
  }
  lines.push("");

  lines.push("── 운영 리스크 ─────────────────────────────────────────────");
  lines.push(`  ${flag(shouldCreateMissed.length)} should_create_record miss: ${shouldCreateMissed.length}건`);
  lines.push(`  ${flag(followupNeeded.length)} requires_followup 발생: ${followupNeeded.length}건`);
  lines.push("");

  lines.push("── Confidence 구간별 오류율 ────────────────────────────────");
  lines.push(`  confidence < 0.3  : ${pct(confBuckets.low,  confBuckets.total_low)}  (${confBuckets.total_low}건 중 ${confBuckets.low}건 교정)`);
  lines.push(`  0.3 ≤ conf < 0.7  : ${pct(confBuckets.mid,  confBuckets.total_mid)}  (${confBuckets.total_mid}건 중 ${confBuckets.mid}건 교정)`);
  lines.push(`  confidence ≥ 0.7  : ${pct(confBuckets.high, confBuckets.total_high)}  (${confBuckets.total_high}건 중 ${confBuckets.high}건 교정)`);
  lines.push("");

  lines.push("── 버전별 교정 건수 ─────────────────────────────────────────");
  lines.push("  [prompt_version]");
  for (const [v, c] of byPromptVersion) lines.push(`    ${v}: ${c}건`);
  lines.push("  [heuristic_version]");
  for (const [v, c] of byHeuristicVersion) lines.push(`    ${v}: ${c}건`);
  lines.push("");

  lines.push("── 피드백 적용 절차 (자동 반영 금지) ───────────────────────");
  lines.push("  1. 위 패턴 검토 → 2. 담당자 승인 → 3. canary 재처리");
  lines.push("  4. 전후 비교 → 5. 전체 반영");
  lines.push("═".repeat(60));

  const report = lines.join("\n");
  console.log(report);

  const outDir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "correction_patterns.md");
  fs.writeFileSync(outFile, report);
  console.log(`\nReport saved: ${outFile}`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});

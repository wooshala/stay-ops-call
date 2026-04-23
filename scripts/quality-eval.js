const fs = require("fs");
const path = require("path");

const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const calls = [
  { file: "010-2071...m4a", intent: "checkin_checkout",    conf: 0.90 },
  { file: "010-2101...m4a", intent: "checkin_checkout",    conf: 0.90 },
  { file: "010-2269...m4a", intent: "complaint",           conf: 0.85 },
  { file: "010-2443...m4a", intent: "reservation_inquiry", conf: 0.85 },
  { file: "010-2700...m4a", intent: "reservation_inquiry", conf: 0.85 },
  { file: "010-2803...m4a", intent: "checkin_checkout",    conf: 0.80 },
  { file: "010-3003...m4a", intent: "maintenance",         conf: 0.85 },
  { file: "010-3243...m4a", intent: "reservation_inquiry", conf: 0.90 },
  { file: "010-3263...m4a", intent: "reservation_inquiry", conf: 0.80 },
  { file: "010-3733...m4a", intent: "other",               conf: 0.80 },
  { file: "010-3916...m4a", intent: "reservation_inquiry", conf: 0.70 },
  { file: "010-4152...m4a", intent: "payment",             conf: 0.78 },
  { file: "010-4767...m4a", intent: "reservation_inquiry", conf: 0.70 },
  { file: "010-4893...m4a", intent: "reservation_inquiry", conf: 0.90 },
  { file: "010-5192...m4a", intent: "reservation_inquiry", conf: 0.90 },
  { file: "010-5238...m4a", intent: "reservation_inquiry", conf: 0.85 },
  { file: "010-5322...m4a", intent: "reservation_inquiry", conf: 0.90 },
  { file: "010-5497...m4a", intent: "maintenance",         conf: 0.85 },
  { file: "010-7435...m4a", intent: "other",               conf: 0.70 },
  { file: "010-7557...m4a", intent: "reservation_inquiry", conf: 0.80 },
  { file: "010-7697...m4a", intent: "reservation_inquiry", conf: 0.80 },
  { file: "010-7924...m4a", intent: "reservation_inquiry", conf: 0.35 },
  { file: "010-8456...m4a", intent: "checkin_checkout",    conf: 0.90 },
  { file: "010-8716...m4a", intent: "reservation_inquiry", conf: 0.70 },
  { file: "010-8854...m4a", intent: "reservation_inquiry", conf: 0.80 },
  { file: "010-8969...m4a", intent: "other",               conf: 0.20 },
  { file: "010-9417...m4a", intent: "other",               conf: 0.20 },
  { file: "010-9456...m4a", intent: "other",               conf: 0.30 },
  { file: "010-9580...m4a", intent: "payment",             conf: 0.88 },
  { file: "010-9957...m4a", intent: "other",               conf: 0.30 },
];

const quality = [
  { n:  1, pred: "checkin_checkout",    exp: "checkin_checkout",    iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.90, notes: "" },
  { n:  2, pred: "checkin_checkout",    exp: "checkin_checkout",    iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.90, notes: "" },
  { n:  3, pred: "complaint",           exp: "maintenance",         iOk: "PARTIAL", sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "키 분실 → maintenance가 더 정확" },
  { n:  4, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "" },
  { n:  5, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "" },
  { n:  6, pred: "checkin_checkout",    exp: "checkin_checkout",    iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.80, notes: "" },
  { n:  7, pred: "maintenance",         exp: "maintenance",         iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "" },
  { n:  8, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.90, notes: "요약 너무 짧음" },
  { n:  9, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.80, notes: "STT 오류 의심 (레브)" },
  { n: 10, pred: "other",              exp: "service_request",     iOk: "FAIL",    sOk: "OK",      wOk: "FAIL",    conf: 0.80, notes: "A4 용지 확인 = service_request" },
  { n: 11, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.70, notes: "대시=대실 STT 오류 의심" },
  { n: 12, pred: "payment",             exp: "reservation_inquiry", iOk: "FAIL",    sOk: "OK",      wOk: "FAIL",    conf: 0.78, notes: "예약확인/입실문의 → payment 오분류" },
  { n: 13, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.70, notes: "요약 너무 짧음" },
  { n: 14, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.90, notes: "" },
  { n: 15, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.90, notes: "" },
  { n: 16, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "" },
  { n: 17, pred: "reservation_inquiry", exp: "checkin_checkout",    iOk: "FAIL",    sOk: "OK",      wOk: "FAIL",    conf: 0.90, notes: "오늘 입실 확인 → checkin_checkout" },
  { n: 18, pred: "maintenance",         exp: "maintenance",         iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.85, notes: "" },
  { n: 19, pred: "other",              exp: "service_request",     iOk: "FAIL",    sOk: "OK",      wOk: "FAIL",    conf: 0.70, notes: "핸드크림 요청 → service_request" },
  { n: 20, pred: "reservation_inquiry", exp: "checkin_checkout",    iOk: "PARTIAL", sOk: "PARTIAL", wOk: "PARTIAL", conf: 0.80, notes: "입실 시간 확인 경계 케이스" },
  { n: 21, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.80, notes: "도브스카 STT 오류 의심" },
  { n: 22, pred: "reservation_inquiry", exp: "other",               iOk: "FAIL",    sOk: "FAIL",    wOk: "FAIL",    conf: 0.35, notes: "STT 노이즈 통화, needs_review 미처리" },
  { n: 23, pred: "checkin_checkout",    exp: "checkin_checkout",    iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.90, notes: "" },
  { n: 24, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.70, notes: "주차+대실 복합, 대실이 주요" },
  { n: 25, pred: "reservation_inquiry", exp: "reservation_inquiry", iOk: "OK",      sOk: "PARTIAL", wOk: "OK",      conf: 0.80, notes: "요약 너무 짧음" },
  { n: 26, pred: "other",              exp: "other",               iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.20, notes: "low_confidence 정책 대상" },
  { n: 27, pred: "other",              exp: "other",               iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.20, notes: "low_confidence 정책 대상" },
  { n: 28, pred: "other",              exp: "reservation_inquiry", iOk: "PARTIAL", sOk: "OK",      wOk: "PARTIAL", conf: 0.30, notes: "성인 인증 = 경계 케이스" },
  { n: 29, pred: "payment",             exp: "payment",             iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.88, notes: "예약+계좌이체 복합" },
  { n: 30, pred: "other",              exp: "other",               iOk: "OK",      sOk: "OK",      wOk: "OK",      conf: 0.30, notes: "빈방 없어 찜질방 추천" },
];

const intentOk = quality.filter(q => q.iOk === "OK").length;
const intentPartial = quality.filter(q => q.iOk === "PARTIAL").length;
const intentFail = quality.filter(q => q.iOk === "FAIL").length;
const summaryOk = quality.filter(q => q.sOk === "OK").length;
const workflowOk = quality.filter(q => q.wOk === "OK").length;

const confs = calls.map(c => c.conf);
const avg = confs.reduce((a,b) => a+b, 0) / confs.length;
const normal = calls.filter(c => c.conf >= 0.7).length;
const needsReview = calls.filter(c => c.conf >= 0.3 && c.conf < 0.7).length;
const lowConf = calls.filter(c => c.conf < 0.3).length;

const intDist = {};
calls.forEach(c => { intDist[c.intent] = (intDist[c.intent] || 0) + 1; });

const shouldCreate = (i) => {
  if (["maintenance","complaint","payment"].includes(i)) return "operation_case";
  if (i === "service_request") return "service_request";
  if (["reservation_inquiry","rate_inquiry","extension_request","quotation_intent"].includes(i)) return "reservation_lead";
  return "skipped";
};

const lines = [];
lines.push("# 30건 품질 평가 보고서 (2026-04-17)");
lines.push("## 새 기준: workflow_status 분리 + 신규 intent taxonomy");
lines.push("");
lines.push("### 집계");
lines.push("| 항목 | 값 |");
lines.push("|------|-----|");
lines.push("| 분석 성공 | 30/30 (100%) |");
lines.push(`| Intent 정확 OK | ${intentOk}/30 (${Math.round(intentOk/30*100)}%) |`);
lines.push(`| Intent 경계 PARTIAL | ${intentPartial}/30 |`);
lines.push(`| Intent 오분류 FAIL | ${intentFail}/30 |`);
lines.push(`| Summary 양호 | ${summaryOk}/30 (${Math.round(summaryOk/30*100)}%) |`);
lines.push(`| Workflow 적절 | ${workflowOk}/30 (${Math.round(workflowOk/30*100)}%) |`);
lines.push("");
lines.push("### confidence 분포");
lines.push("| 구간 | 건수 | 정책 |");
lines.push("|------|------|------|");
lines.push(`| >= 0.7 | ${normal}건 | normal (자동 통과) |`);
lines.push(`| 0.3~0.69 | ${needsReview}건 | needs_review |`);
lines.push(`| < 0.3 | ${lowConf}건 | low_confidence |`);
lines.push(`| 평균 | ${avg.toFixed(3)} | |`);
lines.push("");
lines.push("### intent 분포 (새 taxonomy)");
lines.push("| intent | 건수 | workflow 대상 |");
lines.push("|--------|------|--------------|");
Object.entries(intDist).sort((a,b) => b[1]-a[1]).forEach(([i,n]) => {
  lines.push(`| ${i} | ${n} | ${shouldCreate(i)} |`);
});
lines.push("");
lines.push("### 상세 평가표");
lines.push("| # | 예측 intent | 기대 intent | Intent | Summary | Workflow | Conf | 비고 |");
lines.push("|---|-------------|-------------|--------|---------|----------|------|------|");
quality.forEach(q => {
  const iIcon = q.iOk === "OK" ? "✅" : q.iOk === "PARTIAL" ? "⚠️" : "❌";
  const sIcon = q.sOk === "OK" ? "✅" : q.sOk === "PARTIAL" ? "⚠️" : "❌";
  const wIcon = q.wOk === "OK" ? "✅" : q.wOk === "PARTIAL" ? "⚠️" : "❌";
  lines.push(`| ${q.n} | ${q.pred} | ${q.exp} | ${iIcon} | ${sIcon} | ${wIcon} | ${q.conf} | ${q.notes} |`);
});
lines.push("");
lines.push("### 오분류 패턴 Top 5");
lines.push("");
lines.push("#### 1. checkin_checkout vs reservation_inquiry (3건: #17, #20 + 패턴)");
lines.push("- 오늘 입실 예정 확인, 입실 시간 조정 등이 reservation_inquiry로 분류됨");
lines.push("- **수정 방향**: 프롬프트에서 checkin_checkout 정의를 더 명확히 (예약 '확인' vs 예약 '문의' 구분)");
lines.push("");
lines.push("#### 2. service_request 미인식 (2건: #10, #19)");
lines.push("- 비품/어메니티 요청(A4용지, 핸드크림)이 other로 분류됨");
lines.push("- **수정 방향**: 서비스 요청 예시를 프롬프트에 구체적으로 추가");
lines.push("");
lines.push("#### 3. payment 과분류 (1건: #12)");
lines.push("- 예약 확인/입실 날짜 문의가 payment로 오분류");
lines.push("- **수정 방향**: payment = 실제 결제/입금 행위, 예약 확인은 reservation_inquiry");
lines.push("");
lines.push("#### 4. 저신뢰도 통화 미필터링 (1건: #22, confidence=0.35)");
lines.push("- STT 노이즈 많은 통화가 reservation_inquiry로 분류됨");
lines.push("- **수정 방향**: confidence < 0.5이면 프롬프트에서 other 반환 유도");
lines.push("");
lines.push("#### 5. Summary 품질 저하 (5건: #8, #9, #11, #13, #25)");
lines.push("- '방 예약 문의', '큰 방 예약 문의' 등 날짜/인원/가격 빠진 짧은 요약");
lines.push("- **수정 방향**: 요약 프롬프트에 '날짜, 인원, 금액, 특이사항 포함' 지시 추가");

const reportsDir = path.join(__dirname, "..", "reports");
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
const filename = path.join(reportsDir, `quality-eval-${now}.md`);
fs.writeFileSync(filename, lines.join("\n"), "utf8");
console.log("Report saved:", filename);
console.log("");
console.log("=== QUICK STATS ===");
console.log(`Intent OK: ${intentOk}/30 (${Math.round(intentOk/30*100)}%)`);
console.log(`Intent PARTIAL: ${intentPartial}/30`);
console.log(`Intent FAIL: ${intentFail}/30`);
console.log(`Summary OK: ${summaryOk}/30 (${Math.round(summaryOk/30*100)}%)`);
console.log(`Workflow OK: ${workflowOk}/30 (${Math.round(workflowOk/30*100)}%)`);
console.log(`Conf avg: ${avg.toFixed(3)} | normal:${normal} needs_review:${needsReview} low_conf:${lowConf}`);

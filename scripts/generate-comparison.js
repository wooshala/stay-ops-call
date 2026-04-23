const fs = require("fs");
const path = require("path");

// ── Before: 수동 품질 평가 (2026-04-17 기준)
const before = [
  { n: 1,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.90, pred_i:"checkin_checkout",    exp_i:"checkin_checkout" },
  { n: 2,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.90, pred_i:"checkin_checkout",    exp_i:"checkin_checkout" },
  { n: 3,  iOk:"PARTIAL", sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"complaint",           exp_i:"maintenance" },
  { n: 4,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 5,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 6,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.80, pred_i:"checkin_checkout",    exp_i:"checkin_checkout" },
  { n: 7,  iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"maintenance",         exp_i:"maintenance" },
  { n: 8,  iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.90, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 9,  iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.80, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 10, iOk:"FAIL",    sOk:"OK",      wOk:"FAIL",    conf:0.80, pred_i:"other",               exp_i:"service_request" },
  { n: 11, iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.70, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 12, iOk:"FAIL",    sOk:"OK",      wOk:"FAIL",    conf:0.78, pred_i:"payment",             exp_i:"reservation_inquiry" },
  { n: 13, iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.70, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 14, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.90, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 15, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.90, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 16, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 17, iOk:"FAIL",    sOk:"OK",      wOk:"FAIL",    conf:0.90, pred_i:"reservation_inquiry", exp_i:"checkin_checkout" },
  { n: 18, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.85, pred_i:"maintenance",         exp_i:"maintenance" },
  { n: 19, iOk:"FAIL",    sOk:"OK",      wOk:"FAIL",    conf:0.70, pred_i:"other",               exp_i:"service_request" },
  { n: 20, iOk:"PARTIAL", sOk:"PARTIAL", wOk:"PARTIAL", conf:0.80, pred_i:"reservation_inquiry", exp_i:"checkin_checkout" },
  { n: 21, iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.80, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 22, iOk:"FAIL",    sOk:"FAIL",    wOk:"FAIL",    conf:0.35, pred_i:"reservation_inquiry", exp_i:"other" },
  { n: 23, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.90, pred_i:"checkin_checkout",    exp_i:"checkin_checkout" },
  { n: 24, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.70, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 25, iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      conf:0.80, pred_i:"reservation_inquiry", exp_i:"reservation_inquiry" },
  { n: 26, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.20, pred_i:"other",               exp_i:"other" },
  { n: 27, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.20, pred_i:"other",               exp_i:"other" },
  { n: 28, iOk:"PARTIAL", sOk:"OK",      wOk:"PARTIAL", conf:0.30, pred_i:"other",               exp_i:"other" },
  { n: 29, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.88, pred_i:"payment",             exp_i:"payment" },
  { n: 30, iOk:"OK",      sOk:"OK",      wOk:"OK",      conf:0.30, pred_i:"other",               exp_i:"other" },
];

// ── After: 재처리 결과 (2026-04-18, 새 프롬프트+heuristics)
// after_intent, after_conf, after_summary 를 DB에서 읽어 평가
const afterData = [
  { n: 1,  intent:"checkin_checkout",    conf:0.80, summary:"손님 왕윤주가 3시에 예약한 체크인 시간을 조금 일찍 변경할 수 있는지 문의했습니다.", wf:"skipped" },
  { n: 2,  intent:"checkin_checkout",    conf:0.40, summary:"손님이 퇴실 시간을 두 시간 연장할 수 있는지 문의하였고, 요금이 시간당 만 원임을 확인하였다.", wf:"skipped" },
  { n: 3,  intent:"complaint",          conf:0.70, summary:"203호 객실의 키를 체크아웃할 때 놓고 간 손님이 있습니다.", wf:"completed" },
  { n: 4,  intent:"reservation_inquiry",conf:0.70, summary:"고객이 갤랜드 스위트 2명 예약에 대해 문의하며 차장 한 대를 바꿀 수 있는지 확인하고자 전화했습니다.", wf:"completed" },
  { n: 5,  intent:"reservation_inquiry",conf:0.70, summary:"레이브가 7명 숙박 가능 여부와 가격을 문의하며 그랜드 투베드 방의 가격이 15만 원이라고 확인했습니다.", wf:"completed" },
  { n: 6,  intent:"checkin_checkout",   conf:0.60, summary:"고객이 오늘 3시에 체크인 예약을 했으나 체크인 시간을 30분 정도 늦추고 싶어합니다.", wf:"skipped" },
  { n: 7,  intent:"maintenance",        conf:0.70, summary:"고객이 스위트 방의 TV 고장에 대해 문의했습니다.", wf:"completed" },
  { n: 8,  intent:"reservation_inquiry",conf:0.70, summary:"고객이 큰 방을 5만 원에 예약하기로 결정했습니다.", wf:"completed" },
  { n: 9,  intent:"reservation_inquiry",conf:0.40, summary:"레브라는 고객이 열 시쯤 체크인할 경우 숙박 요금을 문의했다.", wf:"completed" },
  { n: 10, intent:"service_request",    conf:0.45, summary:"602호 체크인 후 TV 아래에 A4 용지가 있는지 문의했습니다.", wf:"completed" },
  { n: 11, intent:"reservation_inquiry",conf:0.40, summary:"손님이 목요일 저녁 6시 이후에 체크인 가능 여부와 요금을 문의했습니다.", wf:"completed" },
  { n: 12, intent:"reservation_inquiry",conf:0.60, summary:"이 기경님은 야놀자를 통해 20일에 체크인 예약을 했으나 알림이 오지 않아 확인하고 있습니다.", wf:"completed" },
  { n: 13, intent:"reservation_inquiry",conf:0.40, summary:"손님이 현재 방이 있는지 문의했으며, 늦은 체크아웃에 대한 질문도 있었습니다.", wf:"completed" },
  { n: 14, intent:"reservation_inquiry",conf:0.45, summary:"김민경 님이 어제 7호에서 숙박 중임을 확인하며 예약 관련 문의를 했습니다.", wf:"completed" },
  { n: 15, intent:"reservation_inquiry",conf:0.70, summary:"손님이 스위트 킹베드 방 예약을 문의했으나 욕조가 있는 방은 모두 예약 완료되었다고 안내받았습니다.", wf:"completed" },
  { n: 16, intent:"reservation_inquiry",conf:0.40, summary:"손님이 내일 저녁에 숙소 요금을 문의했습니다.", wf:"completed" },
  { n: 17, intent:"checkin_checkout",   conf:0.70, summary:"손님이 오늘 체크인 예정임을 확인하기 위해 전화했습니다.", wf:"skipped" },
  { n: 18, intent:"maintenance",        conf:0.60, summary:"608호에서 리모컨이 작동하지 않는 문제를 보고했습니다.", wf:"completed" },
  { n: 19, intent:"service_request",    conf:0.60, summary:"손님이 핸드크림이 없다고 청소팀과 통화한 내용을 확인하고 있습니다.", wf:"completed" },
  { n: 20, intent:"checkin_checkout",   conf:0.60, summary:"고객이 오늘 여섯 시부터 체크인 예약을 확인했습니다.", wf:"skipped" },
  { n: 21, intent:"checkin_checkout",   conf:0.70, summary:"김지흥님이 도브스카를 예약하셨고 일찍 입실할 경우 추가 비용이 발생한다고 안내받았습니다.", wf:"skipped" },
  { n: 22, intent:"other",             conf:0.40, summary:"고객이 슈퍼에 가는 데 걸리는 시간과 6만 원의 요금에 대해 문의했습니다.", wf:"skipped" },
  { n: 23, intent:"checkin_checkout",   conf:0.90, summary:"황채연 고객이 오늘 예약한 숙소의 체크인 시간을 여섯 시에서 조금 더 일찍 변경할 수 있는지 문의했습니다.", wf:"skipped" },
  { n: 24, intent:"reservation_inquiry",conf:0.65, summary:"손님이 내일 대실 예약을 위해 주차장에 대한 문의를 했습니다. 주차 공간이 많다고 안내했습니다.", wf:"completed" },
  { n: 25, intent:"reservation_inquiry",conf:0.40, summary:"고객이 오늘 12시에 방이 있는지 문의했습니다.", wf:"completed" },
  { n: 26, intent:"other",             conf:0.20, summary:"통화 내용이 불분명하여 구체적인 정보가 없습니다.", wf:"skipped" },
  { n: 27, intent:"other",             conf:0.40, summary:"고객이 레이블 호텔에 부재중 전화로 연락을 시도했으나 구체적인 요청이나 문제는 언급되지 않았습니다.", wf:"skipped" },
  { n: 28, intent:"other",             conf:0.40, summary:"고객이 성인 인증 방법에 대해 문의하고 있습니다.", wf:"skipped" },
  { n: 29, intent:"payment",            conf:0.65, summary:"고객이 방 예약을 원하며 계좌이체로 결제를 하겠다고 언급했습니다.", wf:"completed" },
  { n: 30, intent:"other",             conf:0.40, summary:"고객이 숙소 근처에 방이 없다고 문의하며 찜질방을 추천받았습니다.", wf:"skipped" },
];

// ── After 품질 평가
const afterEval = [
  { n: 1,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"" },
  { n: 2,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"P1 fix: 임계값 0.3으로 수정 + 요약 규칙(a) 적용: 퇴실 연장, 시간당 만 원" },
  { n: 3,  iOk:"PARTIAL", sOk:"OK",      wOk:"OK",      notes:"키 분실 = maintenance가 더 정확하나 complaint도 수용 가능" },
  { n: 4,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (2명, 차장)" },
  { n: 5,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 대폭 개선 (7명, 15만원, 그랜드 투베드)" },
  { n: 6,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"" },
  { n: 7,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"" },
  { n: 8,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (5만원 가격 포함)" },
  { n: 9,  iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선: 이름(레브), 열 시 체크인 포함" },
  { n: 10, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: other→service_request" },
  { n: 11, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선: 대시 STT 오류 → 체크인 가능 여부와 요금으로 교정" },
  { n: 12, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: payment→reservation_inquiry, 요약 대폭 개선 (야놀자, 20일)" },
  { n: 13, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선: availability→현재 방, 늦은 체크아웃 추가" },
  { n: 14, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선: 피드백 제거, 7호 숙박 확인으로 교정" },
  { n: 15, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (욕조 방 예약 완료)" },
  { n: 16, iOk:"OK",      sOk:"PARTIAL", wOk:"OK",      notes:"요약 소폭 개선. transcript 자체에 세부 정보 없음" },
  { n: 17, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: reservation_inquiry→checkin_checkout" },
  { n: 18, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (608호 포함)" },
  { n: 19, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: other→service_request" },
  { n: 20, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: reservation_inquiry→checkin_checkout" },
  { n: 21, iOk:"PARTIAL", sOk:"OK",      wOk:"FAIL",    notes:"reservation_inquiry→checkin_checkout 과보정 (예약 문의였으나 일찍 입실 맥락 포착)" },
  { n: 22, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: reservation_inquiry→other + 요약 개선 (슈퍼 소요 시간, 6만 원)" },
  { n: 23, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 최고 수준 (이름, 시간 포함)" },
  { n: 24, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"P3 fix: parking→reservation_inquiry 복원 (대실 예약이 주 의도)" },
  { n: 25, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (오늘 12시 포함)" },
  { n: 26, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"" },
  { n: 27, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"요약 개선 (부재중 전화 맥락)" },
  { n: 28, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"IMPROVED: partial→OK (성인인증 other 정확)" },
  { n: 29, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"P2 fix: payment 복원 (reservation_inquiry에서도 STRONG_HINTS 적용)" },
  { n: 30, iOk:"OK",      sOk:"OK",      wOk:"OK",      notes:"" },
];

// ── Scoring
const score = (arr, field) => arr.filter(r => r[field] === "OK").length;
const B = { iOk: score(before,"iOk"), sOk: score(before,"sOk"), wOk: score(before,"wOk") };
const A = { iOk: score(afterEval,"iOk"), sOk: score(afterEval,"sOk"), wOk: score(afterEval,"wOk") };
const N = 30;

const pct = (n) => (n/N*100).toFixed(1);
const delta = (a,b) => { const d = (a-b)/N*100; return (d >= 0 ? "+" : "") + d.toFixed(1); };

// Confidence
const confBefore = [0.90,0.90,0.85,0.85,0.85,0.80,0.85,0.90,0.80,0.80,0.70,0.78,0.70,0.90,0.90,0.85,0.90,0.85,0.70,0.80,0.80,0.35,0.90,0.70,0.80,0.20,0.20,0.30,0.88,0.30];
const confAfter  = afterData.map(r=>r.conf);
const avg = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
const normalB = confBefore.filter(c=>c>=0.7).length;
const normalA = confAfter.filter(c=>c>=0.7).length;
const nrB = confBefore.filter(c=>c>=0.3&&c<0.7).length;
const nrA = confAfter.filter(c=>c>=0.3&&c<0.7).length;

// Pattern analysis
const patterns = [
  {
    name: "checkin_checkout vs reservation_inquiry 혼동",
    before_count: 3,
    after_count: afterEval.filter(r=>[2,21,24].includes(r.n)&&r.iOk!=="OK").length,
    after_cases: afterEval.filter(r=>before.find(b=>b.n===r.n)?.pred_i==="reservation_inquiry"&&r.n!==before.find(b=>b.n===r.n)?.n)
  },
  { name: "service_request → other 미분류", before_count: 2, after_count: afterEval.filter(r=>[10,19].includes(r.n)&&r.iOk!=="OK").length },
  { name: "payment 과분류", before_count: 1, after_count: afterEval.filter(r=>[12,29].includes(r.n)&&r.iOk!=="OK").length },
  { name: "저신뢰도 통화 미처리", before_count: 1, after_count: afterEval.filter(r=>[22].includes(r.n)&&r.iOk!=="OK").length },
  { name: "Summary 정보 부족", before_count: 5, after_count: afterEval.filter(r=>r.sOk==="PARTIAL"||r.sOk==="FAIL").length },
];

// Regressions
const regressions = before.map(b => {
  const a = afterEval.find(x=>x.n===b.n);
  return { n:b.n, before_i:b.iOk, after_i:a.iOk, before_w:b.wOk, after_w:a.wOk };
}).filter(r => (r.before_i==="OK"&&r.after_i!=="OK") || (r.before_w==="OK"&&r.after_w!=="OK"));

const improvements = before.map(b => {
  const a = afterEval.find(x=>x.n===b.n);
  return { n:b.n, before_i:b.iOk, after_i:a.iOk };
}).filter(r => (r.before_i==="FAIL"&&r.after_i==="OK") || (r.before_i==="PARTIAL"&&r.after_i==="OK"));

// ── Build report
const lines = [];
lines.push("# 배치 재처리 평가 보고서 (2026-04-18)");
lines.push("## 프롬프트 + Heuristics 튜닝 효과 측정");
lines.push("");
lines.push("## 1. 전체 정확도 비교");
lines.push("");
lines.push("| 항목 | Before | After | Delta |");
lines.push("|------|--------|-------|-------|");
lines.push(`| Intent Accuracy | ${pct(B.iOk)}% (${B.iOk}/30) | ${pct(A.iOk)}% (${A.iOk}/30) | **${delta(A.iOk,B.iOk)}%** |`);
lines.push(`| Summary Quality | ${pct(B.sOk)}% (${B.sOk}/30) | ${pct(A.sOk)}% (${A.sOk}/30) | **${delta(A.sOk,B.sOk)}%** |`);
lines.push(`| Workflow Accuracy | ${pct(B.wOk)}% (${B.wOk}/30) | ${pct(A.wOk)}% (${A.wOk}/30) | **${delta(A.wOk,B.wOk)}%** |`);
lines.push("");
lines.push("## 2. Confidence 분포 변화");
lines.push("");
lines.push("| 구간 | Before | After | 비고 |");
lines.push("|------|--------|-------|------|");
lines.push(`| >= 0.7 (normal) | ${normalB}건 | ${normalA}건 | LLM이 더 보수적 confidence 출력 |`);
lines.push(`| 0.3~0.69 (needs_review) | ${nrB}건 | ${nrA}건 | |`);
lines.push(`| < 0.3 (low_confidence) | ${confBefore.filter(c=>c<0.3).length}건 | ${confAfter.filter(c=>c<0.3).length}건 | |`);
lines.push(`| 평균 | ${avg(confBefore).toFixed(3)} | ${avg(confAfter).toFixed(3)} | -${(avg(confBefore)-avg(confAfter)).toFixed(3)} |`);
lines.push("");
lines.push("## 3. 오분류 패턴 재검증");
lines.push("");
lines.push("| # | 패턴 | Before | After | 상태 |");
lines.push("|---|------|--------|-------|------|");
const p1_after = afterEval.filter(r=>[17,20,21].includes(r.n)).filter(r=>r.iOk!=="OK").length;
const p3_after = afterEval.filter(r=>[29].includes(r.n)).filter(r=>r.iOk!=="OK").length; // #12 improved, #29 regressed
lines.push(`| 1 | checkin_checkout vs reservation_inquiry 혼동 | 3건 | ${p1_after}건 | ${p1_after<3?"✅ IMPROVED":"⚠️ UNCHANGED"} |`);
lines.push(`| 2 | service_request → other 미분류 | 2건 | 0건 | ✅ FULLY FIXED |`);
lines.push(`| 3 | payment 과분류 (#12 fix, #29 new regression) | 1건 | ${p3_after}건 | ${p3_after<=1?"✅ IMPROVED":"⚠️ PARTIAL"} |`);
lines.push(`| 4 | 저신뢰도 통화 미처리 (#22 fix, #2 regression) | 1건 | 1건 | ⚠️ UNCHANGED (다른 케이스) |`);
lines.push(`| 5 | Summary 정보 부족 | 5건 | ${afterEval.filter(r=>r.sOk==="PARTIAL"||r.sOk==="FAIL").length}건 | ${afterEval.filter(r=>r.sOk==="PARTIAL"||r.sOk==="FAIL").length<5?"✅ IMPROVED":"⚠️ UNCHANGED"} |`);
lines.push("");
lines.push("## 4. 개선된 케이스 (FAIL/PARTIAL → OK)");
lines.push("");
improvements.forEach(r => {
  const note = afterEval.find(x=>x.n===r.n)?.notes || "";
  lines.push(`- **#${r.n}**: ${r.before_i} → ${r.after_i} — ${note}`);
});
lines.push("");
lines.push("## 5. 회귀(Regression) 케이스 (OK → FAIL/PARTIAL)");
lines.push("");
regressions.forEach(r => {
  const note = afterEval.find(x=>x.n===r.n)?.notes || "";
  lines.push(`- **#${r.n}**: intent ${r.before_i}→${r.after_i}, workflow ${r.before_w}→${r.after_w} — ${note}`);
});
lines.push("");
lines.push("## 6. 근본 원인 분석");
lines.push("");
lines.push("### 회귀 원인 1: 저신뢰도 fallback 임계값 과도함");
lines.push("- `confidence < 0.4 → other` 규칙이 #2(퇴실 연장, conf=0.35)를 잘못 분류");
lines.push("- **수정**: 임계값을 0.4 → 0.3으로 낮추거나, STT 노이즈 패턴만 체크");
lines.push("");
lines.push("### 회귀 원인 2: checkin_checkout 과보정");
lines.push("- #21(도브스카 예약 문의)이 '일찍 입실' 맥락으로 checkin_checkout 분류됨");
lines.push("- #24(주차+대실)에서 parking이 reservation_inquiry보다 우선됨");
lines.push("- **수정**: checkin_checkout 분류 시 예약 맥락(신규 예약 언급)이 없을 때만 적용");
lines.push("");
lines.push("### 회귀 원인 3: payment → reservation_inquiry (#29)");
lines.push("- '계좌이체로 결제'를 언급했으나 reservation_inquiry로 변경됨");
lines.push("- **수정**: PAYMENT_STRONG_HINTS에 '계좌이체' 명시적 추가 + reservation_inquiry→payment 전환 허용");
lines.push("");
lines.push("### Confidence 하락 원인");
lines.push("- 새 프롬프트가 정의를 명확히 제시하여 LLM이 더 정직하게 낮은 신뢰도 출력");
lines.push("- 이는 review 정책 입장에서 긍정적 (과신하던 것들이 needs_review로 이동)");
lines.push("- **BUT** needs_review 건수: Before 3건 → After 19건 (검수 부담 대폭 증가)");
lines.push("");
lines.push("## 7. 성공 기준 판단");
lines.push("");
const passI = A.iOk/N >= 0.85;
const passS = A.sOk/N >= 0.85;
const passW = A.wOk/N >= 0.85;
lines.push(`| 기준 | 목표 | 결과 | 판정 |`);
lines.push(`|------|------|------|------|`);
lines.push(`| Intent Accuracy | ≥ 85% | ${pct(A.iOk)}% | ${passI?"✅ PASS":"❌ FAIL"} |`);
lines.push(`| Summary Quality | ≥ 85% | ${pct(A.sOk)}% | ${passS?"✅ PASS":"❌ FAIL"} |`);
lines.push(`| Workflow Accuracy | ≥ 85% | ${pct(A.wOk)}% | ${passW?"✅ PASS":"❌ FAIL"} |`);
lines.push("");
lines.push(`**최종 판정: ${passI&&passS&&passW?"🎉 튜닝 성공":"⚠️ 추가 튜닝 필요"} (PASS: ${[passI,passS,passW].filter(Boolean).length}/3)**`);
lines.push("");
lines.push("## 8. 다음 개선 포인트 Top 3");
lines.push("");
lines.push("### P1 — 저신뢰도 fallback 임계값 조정 (0.4 → 0.3)");
lines.push("- 영향: #2 케이스 복구 예상, intent 83% → ~87% 가능");
lines.push("- 파일: `lib/analysis/heuristics.ts` confidence < 0.4 조건 수정");
lines.push("");
lines.push("### P2 — payment 강화: reservation_inquiry → payment 전환 조건 추가");
lines.push("- 영향: #29 케이스 복구, payment 정확도 향상");
lines.push("- 수정: PAYMENT_STRONG_HINTS에 '계좌이체'/'입금 완료' 추가 + reservation_inquiry도 payment 후보로 허용");
lines.push("");
lines.push("### P3 — checkin_checkout 과보정 방지: 신규 예약 맥락 예외 처리");
lines.push("- 영향: #21 케이스 복구, reservation_inquiry 유지");
lines.push("- 수정: CHECKIN_HINTS 정규식에서 '예약' 단독 언급은 제외하는 네거티브 패턴 추가");

const outDir = path.join(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "batch_reprocess_evaluation.md");
fs.writeFileSync(outFile, lines.join("\n"), "utf8");
console.log("Report saved:", outFile);

// ── JSON comparison
const comparison = {
  before: { intent_accuracy: B.iOk/N, summary_quality: B.sOk/N, workflow_accuracy: B.wOk/N, conf_avg: avg(confBefore) },
  after:  { intent_accuracy: A.iOk/N, summary_quality: A.sOk/N, workflow_accuracy: A.wOk/N, conf_avg: avg(confAfter) },
  delta:  { intent: (A.iOk-B.iOk)/N, summary: (A.sOk-B.sOk)/N, workflow: (A.wOk-B.wOk)/N, conf: avg(confAfter)-avg(confBefore) },
  patterns: patterns.map(p=>({...p, after_cases: undefined})),
  improvements: improvements.map(r=>r.n),
  regressions: regressions.map(r=>r.n),
  verdict: passI&&passS&&passW ? "PASS" : "NEEDS_IMPROVEMENT",
  pass_count: [passI,passS,passW].filter(Boolean).length,
};
const jsonFile = path.join(__dirname, "..", "reports", "batch_comparison.json");
fs.writeFileSync(jsonFile, JSON.stringify(comparison, null, 2));
console.log("Comparison JSON:", jsonFile);

// ── Console output
const fmt = (n) => (n*100).toFixed(1) + "%";
const dfmt = (n) => (n>=0?"+":"") + (n*100).toFixed(1) + "%";
console.log("\n" + "=".repeat(40));
console.log("=== BATCH REPROCESS RESULT ===");
console.log("=".repeat(40));
console.log(`Intent Accuracy:   ${fmt(A.iOk/N)} (Δ ${dfmt((A.iOk-B.iOk)/N)})  ${passI?"✅ PASS":"❌ FAIL"}`);
console.log(`Summary Quality:   ${fmt(A.sOk/N)} (Δ ${dfmt((A.sOk-B.sOk)/N)})  ${passS?"✅ PASS":"❌ FAIL"}`);
console.log(`Workflow Accuracy: ${fmt(A.wOk/N)} (Δ ${dfmt((A.wOk-B.wOk)/N)})  ${passW?"✅ PASS":"❌ FAIL"}`);
console.log(`Confidence Avg:    ${avg(confBefore).toFixed(3)} → ${avg(confAfter).toFixed(3)} (Δ ${dfmt(avg(confAfter)-avg(confBefore))})`);
console.log("");
console.log("Top Improvements:");
improvements.slice(0,5).forEach(r => {
  const note = afterEval.find(x=>x.n===r.n)?.notes?.split(" (")[0] || "";
  console.log(`  - #${r.n}: ${before.find(b=>b.n===r.n).pred_i} → ${afterData.find(a=>a.n===r.n).intent} ${note}`);
});
console.log("");
console.log("Remaining Issues:");
regressions.forEach(r => {
  console.log(`  - #${r.n}: ${afterEval.find(x=>x.n===r.n)?.notes?.slice(0,60) || "regression"}`);
});
console.log(`  - Confidence 하락: ${avg(confBefore).toFixed(3)} → ${avg(confAfter).toFixed(3)} (needs_review 3건 → 19건)`);
console.log("");
console.log(`Final Verdict: ${passI&&passS&&passW?"🎉 SUCCESS — 튜닝 성공":"⚠️ NEEDS IMPROVEMENT"}`);
console.log(`(PASS: ${[passI,passS,passW].filter(Boolean).length}/3 — Workflow ${passW?"✅":"❌"}, Intent ${passI?"✅":"❌"}, Summary ${passS?"✅":"❌"})`);
console.log("=".repeat(40));

/**
 * CALL-ANALYSIS-QUEUE-002 상태 계약 검증.
 *
 *   npm run verify:uncertain-state
 *
 * 이 저장소에는 단위 테스트 러너가 없어(playwright 만) 기존 `tsx` 로 돌리는
 * 계약 스크립트로 자동화한다. DB·네트워크에 접근하지 않는다.
 *
 * 고정하는 계약:
 *  1. 정상 transcript → uncertain 아님 → LLM 경로(runAnalysisForCall)로 간다
 *  2. 짧은 transcript → uncertain → LLM 생략 + 종결 patch 생성
 *  3. 반복 transcript → uncertain → LLM 생략 + 종결 patch 생성
 *  4. 종결 patch 가 queued 를 남기지 않는 형태인지(코드·사유 포함)
 *  5. 사유 문구에 transcript 원문이 새지 않는지
 *  6. calls update 전부 실패("none") 시 조용히 넘어가지 않고 오류 로그를 남기는지
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  assessTranscriptUncertainty,
  buildUncertainAnalysisResult,
} from "../lib/analysis/transcriptUncertainty";
import { buildUncertainSkipPatch } from "../lib/pipeline/processUploadedCallForStt";

let failed = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 1. 정상 transcript → LLM 경로 ──────────────────────────────
console.log("[1] 정상 transcript → uncertain 아님(LLM 실행 경로)");
const normal =
  "안녕하세요 내일 밤 스탠다드 객실 예약하고 싶은데요. 성인 두 명이고 " +
  "체크인은 오후 여섯시쯤 될 것 같습니다. 주차도 한 대 가능할까요? " +
  "요금은 얼마인지 알려주시면 감사하겠습니다.";
const normalAssess = assessTranscriptUncertainty({
  transcript: normal,
  durationSec: 120,
});
check("uncertain=null 이어야 함", normalAssess === null,
  normalAssess ? `warnings=${normalAssess.warnings.join(",")}` : undefined);

// ── 2. 짧은 transcript ────────────────────────────────────────
console.log("[2] 짧은 transcript → uncertain + 종결 patch");
const shortAssess = assessTranscriptUncertainty({
  transcript: "네 알겠습니다",
  durationSec: null,
});
check("uncertain 판정", shortAssess !== null);
check("사유에 short_transcript 포함",
  !!shortAssess?.warnings.includes("short_transcript"));
check("skipLlm=true (LLM 호출 안 함)", shortAssess?.skipLlm === true);

if (shortAssess) {
  const analysis = buildUncertainAnalysisResult(shortAssess, "네 알겠습니다");
  const patch = buildUncertainSkipPatch(shortAssess, analysis);
  check("summary 존재", !!patch.summary && patch.summary.length > 0);
  check("analysis_error_code = transcript_uncertain",
    patch.analysis_error_code === "transcript_uncertain");
  check("사유 문구에 short_transcript 표기",
    !!patch.analysis_error_message?.includes("short_transcript"));
  check("사유 문구에 transcript 원문 없음",
    !patch.analysis_error_message?.includes("네 알겠습니다"));
}

// ── 3. 반복 transcript ────────────────────────────────────────
console.log("[3] 반복 transcript → uncertain + 종결 patch");
const repeated = "여보세요 들리세요. 여보세요 들리세요. 여보세요 들리세요.";
const repAssess = assessTranscriptUncertainty({
  transcript: repeated,
  durationSec: 60,
});
check("uncertain 판정", repAssess !== null);
check("사유에 repetitive_transcript 포함",
  !!repAssess?.warnings.includes("repetitive_transcript"));

if (repAssess) {
  const analysis = buildUncertainAnalysisResult(repAssess, repeated);
  const patch = buildUncertainSkipPatch(repAssess, analysis);
  check("summary 존재", !!patch.summary && patch.summary.length > 0);
  check("analysis_error_code = transcript_uncertain",
    patch.analysis_error_code === "transcript_uncertain");
  check("사유 문구에 repetitive_transcript 표기",
    !!patch.analysis_error_message?.includes("repetitive_transcript"));
  check("사유 문구에 transcript 원문 없음",
    !patch.analysis_error_message?.includes("여보세요"));
}

// ── 3-b. repetitive 임계치 계약 (CALL-ANALYSIS-QUEUE-003) ─────
console.log("[3-b] repetitive 임계치 — 2회는 통과, 3회는 보류");

// (1) 정상 긴 transcript — 반복 없음
const longNormal =
  "안녕하세요 다음 주 금요일에 디럭스 객실 두 개 예약 가능한지 문의드립니다. " +
  "성인 네 명이고 아이는 없습니다. 체크인은 오후 다섯시쯤 예정이고요. " +
  "주차는 두 대 필요합니다. 조식 포함 요금도 함께 알려주시면 좋겠습니다. " +
  "혹시 연박 할인이 있는지도 궁금합니다.";
check("정상 긴 통화 → uncertain 아님",
  assessTranscriptUncertainty({ transcript: longNormal, durationSec: 180 }) === null);

// (2) "네 알겠습니다" 2회 — 정상 통화에서 흔함 → 보류하지 않아야 함
const twiceAck =
  "네 알겠습니다. 내일 오후에 체크인 예정이고 성인 두 명입니다. " +
  "주차 한 대 가능한지 확인 부탁드립니다. 네 알겠습니다. " +
  "그럼 그렇게 예약해 주세요 감사합니다.";
const twiceAssess = assessTranscriptUncertainty({ transcript: twiceAck, durationSec: 90 });
check("동일 문장 2회 반복 → repetitive 아님",
  !twiceAssess?.warnings.includes("repetitive_transcript"),
  twiceAssess ? `warnings=${twiceAssess.warnings.join(",")}` : undefined);

// (3) 실제 반복 음성 3회 — 여전히 검출되어야 함
const thrice =
  "여보세요 들리세요. 여보세요 들리세요. 여보세요 들리세요. 여보세요 들리세요.";
check("동일 문장 3회 이상 → repetitive 검출 유지",
  !!assessTranscriptUncertainty({ transcript: thrice, durationSec: 60 })
    ?.warnings.includes("repetitive_transcript"));

// (4) 짧은 transcript — 임계치 변경과 무관하게 그대로 보류
const shortStill = assessTranscriptUncertainty({ transcript: "네", durationSec: 30 });
check("짧은 transcript → short_transcript 유지",
  !!shortStill?.warnings.includes("short_transcript"));

// ── 4·6. 소스 계약 (queued 잔류 방지 · 실패 은폐 금지) ──────────
console.log("[4] 파이프라인 소스 계약");
const src = readFileSync(
  fileURLToPath(new URL("../lib/pipeline/processUploadedCallForStt.ts", import.meta.url)),
  "utf8",
);
const uncertainBlock = src.slice(
  src.indexOf("if (uncertain) {"),
  src.indexOf("} else {", src.indexOf("if (uncertain) {")),
);
check("uncertain 분기가 calls 종결 write 를 수행",
  uncertainBlock.includes("tryUpdateCallAnalysisSkipped"));
check("persistLevel 'none' 을 검사",
  uncertainBlock.includes('persistLevel === "none"'));
check("실패 시 오류 로그(조용한 성공 금지)",
  uncertainBlock.includes("CALL_ANALYSIS_TERMINAL_PERSIST_FAILED"));
check("uncertain 로그에 summary 원문을 싣지 않음",
  !/summary:\s*analysis\.summary/.test(uncertainBlock));

// ── 5. pending_events 기존 동작 유지 ──────────────────────────
console.log("[5] pending_events 갱신 경로 유지");
check("updatePendingEventAfterStt 호출 유지",
  src.includes("updatePendingEventAfterStt"));

console.log();
if (failed > 0) {
  console.error(`FAILED: ${failed} check(s)`);
  process.exit(1);
}
console.log("ALL CHECKS PASSED");

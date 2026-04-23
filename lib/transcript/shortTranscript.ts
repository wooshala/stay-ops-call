/**
 * 비용 절감: 의미 없는 짧은 STT는 LLM 분석 생략.
 * `cleanTranscript()` 적용 후 문자열 기준으로 판단.
 */

const MIN_LENGTH = 10;
const MIN_NON_WHITESPACE = 5;

/** 끝 문장부호 제거 후 전체가 이 집합과 일치하면 스킵 */
const TRIVIAL_PHRASES = new Set([
  "여보세요",
  "여보세",
  "네",
  "네요",
  "예",
  "예요",
  "응",
  "응응",
  "끊김",
  "끊겼",
  "끊을게요",
  "끊을게",
  "hello",
  "하이",
]);

function nonWhitespaceLength(s: string): number {
  return s.replace(/\s+/g, "").length;
}

/** 앞뒤 공백·끝 문장부호 정리 */
function normalizePhrase(s: string): string {
  return s
    .trim()
    .replace(/[.!?…。]+$/g, "")
    .trim()
    .toLowerCase();
}

/**
 * LLM 분석을 건너뛸 만큼 짧거나 무의미한지.
 * `cleaned`는 `cleanTranscript(raw)` 결과를 넣는 것을 권장.
 */
export function shouldSkipTranscriptForAnalysis(cleaned: string): boolean {
  const t = cleaned.trim();
  if (!t) return true;

  if (t.length < MIN_LENGTH) return true;

  if (nonWhitespaceLength(t) < MIN_NON_WHITESPACE) {
    return true;
  }

  const n = normalizePhrase(t);
  if (TRIVIAL_PHRASES.has(n)) return true;

  return false;
}

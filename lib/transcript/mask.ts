/**
 * 분석 전용: 카드·긴 숫자열 마스킹, 전화번호 토큰화, 숫자 반복 축약.
 * 원본 STT는 호출부에서 변경하지 않는다.
 */

/** 휴대폰/지역번호 형태는 [PHONE]으로 치환 (마스킹 대상과 구분) */
const RE_PHONE_LIKE =
  /\b(?:0\d{1,2})[-\s]?\d{3,4}[-\s]?\d{4}\b|\b010\d{8}\b|\b(?:0\d{1,2})\d{7,9}\b/g;

/** 4자리×4 그룹 카드 형태 (공백·하이픈 허용) */
const RE_CARD_16 =
  /\b(?:\d{4}[-\s]*){3}\d{4}\b/g;

/** 13~19자리 연속 숫자 (카드번호 등) */
const RE_LONG_DIGITS = /\d{13,19}/g;

/** 4자리 이상 연속 숫자 (남은 구간) */
const RE_DIGITS_4_PLUS = /\d{4,}/g;

/** 마스킹 블록 과다 반복 축약 */
const RE_MASK_SPAM = /(?:\*\*\*\*\s*){6,}/g;

/**
 * STT 본문에서 분석 입력용으로 민감 숫자를 마스킹한다.
 * - 전화 패턴 → [PHONE]
 * - 16자리 카드 패턴 → **** **** **** ****
 * - 13자리 이상 연속 숫자 → **** **** **** ****
 * - 그 외 4자리 이상 연속 숫자 → ****
 */
export function maskSensitiveDigits(text: string): string {
  let s = text;
  s = s.replace(RE_PHONE_LIKE, "[PHONE]");
  s = s.replace(RE_CARD_16, "**** **** **** ****");
  s = s.replace(RE_LONG_DIGITS, "**** **** **** ****");
  s = s.replace(RE_DIGITS_4_PLUS, "****");
  return s;
}

/**
 * 금액·숫자 반복 노이즈 완화 (마스킹 후 호출 권장).
 */
export function reduceDigitNoise(text: string): string {
  let s = text.replace(RE_MASK_SPAM, "**** … ");
  s = s.replace(/(\b\*\*\*\*\b)(\s+\1){4,}/g, "$1 …");
  return s.replace(/\s{2,}/g, " ").trim();
}

export function maskAndNormalizeForAnalysis(raw: string): string {
  const masked = maskSensitiveDigits(raw.trim());
  return reduceDigitNoise(masked);
}

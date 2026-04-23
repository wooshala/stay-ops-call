/**
 * 분류 결과에 영향을 주는 변경 시 버전을 올린다.
 * 리팩토링·포맷 변경만이면 유지해도 된다.
 */
export const MODEL_VERSION = "claude-sonnet-4-6";
export const PROMPT_VERSION = "v1.1";      // summary 규칙 5개 추가 (2026-04-18)
export const HEURISTIC_VERSION = "v1.2";   // low-conf 임계값 0.3, payment STRONG_HINTS 확장 (2026-04-18)

/**
 * STT 원문을 분석 친화적으로 정리 (도메인 전처리).
 * 반복 제거는 `cleanTranscriptRepetition`에 위임.
 */

import { cleanTranscriptRepetition } from "@/lib/transcript/preprocess";

const FILLER_PHRASES = [
  "여보세요",
  "잠시만요",
  "네네",
  "네 네",
  "예예",
  "어...",
  "음...",
  "그...",
];

/**
 * 줄바꿈 정리 → 반복 인사 축소 → 가벼운 filler 제거 → 문장 반복 제거 → 공백 정리.
 * 과도한 제거로 의미가 사라지지 않게 filler 목록은 보수적으로 유지.
 */
export function cleanTranscript(raw: string): string {
  if (!raw) return "";

  let text = raw.replace(/\n+/g, " ");

  text = text.replace(/(?:네\s*){2,}/g, "네 ");
  text = text.replace(/(?:예\s*){2,}/g, "예 ");

  for (const filler of FILLER_PHRASES) {
    if (text.includes(filler)) {
      text = text.split(filler).join(" ");
    }
  }

  text = cleanTranscriptRepetition(text);
  return text.replace(/\s+/g, " ").trim();
}

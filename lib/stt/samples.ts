/**
 * Hardcoded Korean STT samples for mock STT and analysis testing.
 */
export const MOCK_STT_SAMPLES: readonly string[] = [
  "605호인데 수건 몇 개만 올려주세요",
  "303호 보일러가 너무 뜨거워요",
  "오늘 스탠다드 얼마예요?",
  "28일에 3명인데 침대 구성 어떻게 되나요?",
  "청소팀이 카드키를 잘못 눌러서 고객이 놀랐어요",
  "계약금 입금이요 카드 번호는 4518 4445 1299 6478 이고요 영수증 메일로 보내주세요",
  "단체 견적입니다. 3월 5일부터 3박 객실 20실 인원 80명 주차 15대요 총 800만원이면 카드도 됩니다",
] as const;

export function getMockTranscriptByIndex(index: number): string {
  const i = ((index % MOCK_STT_SAMPLES.length) + MOCK_STT_SAMPLES.length) % MOCK_STT_SAMPLES.length;
  return MOCK_STT_SAMPLES[i] ?? MOCK_STT_SAMPLES[0]!;
}

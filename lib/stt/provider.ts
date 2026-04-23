/**
 * STT 공통 계약. 구현체: mock(테스트), openai(프로덕션).
 * 확장: diarization/timestamps는 transcribeAudio 내부 또는 별도 메서드로 추가 가능.
 */
export interface SttResult {
  transcript: string;
  /** OpenAI 등 일부 제공자는 세션 단위 confidence 미제공 → null */
  confidence: number | null;
  provider: string;
}

export interface SttProvider {
  transcribeAudio(params: {
    storageBucket: string;
    storagePath: string;
    /** mock 전용: 샘플 인덱스 */
    mockSampleIndex?: number;
  }): Promise<SttResult>;
}

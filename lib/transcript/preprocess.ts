/**
 * STT 원본 전처리: 반복 문장/문단 축소 후, 민감·숫자 노이즈 처리, 필요 시 분석용 짧은 텍스트 생성.
 */

import { maskAndNormalizeForAnalysis } from "@/lib/transcript/mask";

const MAX_ANALYSIS_CHARS = 6000;
const MAX_SHORT_OUTPUT = 12000;

function normalizeForDedup(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function isSimilarSentence(a: string, b: string): boolean {
  const na = normalizeForDedup(a);
  const nb = normalizeForDedup(b);
  if (na.length < 8 || nb.length < 8) return na === nb;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ratio =
    (2 * Math.min(na.length, nb.length)) / (na.length + nb.length);
  return ratio > 0.82;
}

/** 연속 동일 문단 제거 */
function collapseConsecutiveDuplicateParagraphs(text: string): string {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (out[out.length - 1] !== line) out.push(line);
  }
  return out.join("\n");
}

/** 문장 단위: 동일·유사 문장은 첫 등장만 유지 */
function dedupeSentencesGlobally(text: string): string {
  const chunks = text
    .split(/(?<=[.!?。…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const kept: string[] = [];
  for (const chunk of chunks) {
    const key = normalizeForDedup(chunk);
    if (key.length < 2) {
      kept.push(chunk);
      continue;
    }
    const dup = kept.some((prev) => isSimilarSentence(prev, chunk));
    if (dup) continue;
    kept.push(chunk);
  }

  return kept.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 반복 제거 후 cleaned transcript.
 */
export function cleanTranscriptRepetition(raw: string): string {
  let t = raw.trim();
  if (!t) return "";
  t = collapseConsecutiveDuplicateParagraphs(t);
  t = dedupeSentencesGlobally(t);
  return t;
}

/** 예약·가격·객실·접근성 등 분석에 중요한 문장 우선 */
const KEYWORD_LINE =
  /예약|내일|모레|몇\s*시|몇시|방|큰\s*방|욕조|가격|요금|현금|결제|카드|입실|퇴실|투숙|인원|도착|객실|호텔|체크인|체크아웃|층|타입|스탠다드|디럭스|트윈|더블|싱글|침대|환불|취소|변경|연장|접근|휠체어|장애|엘리베이터|승강기|경사|계단|불편|민원|컴플레인|문의|가능|여부|계약금|입금|할부|영수증|계좌|단체/;

/** 견적·단체 추출용 추가 키워드 */
const EXTRACT_QUOT_EXTRA =
  /견적|패키지|행사|워크숍|객실\s*수|몇\s*실|주차|입실일|퇴실일|룸|견적서|팀빌딩|단체\s*예약|연수|세미나/;

function sentenceMatchesExtraction(s: string): boolean {
  return KEYWORD_LINE.test(s) || EXTRACT_QUOT_EXTRA.test(s);
}

const MAX_EXTRACTION_CHARS = 12000;

/**
 * 긴 통화에서도 핵심 필드 추출에 쓰일 문장만 모은 텍스트 (분석 입력보다 먼저 계산).
 */
export function buildExtractionFocusedText(maskedNormalized: string): string {
  const t = maskedNormalized.trim();
  if (!t) return "";
  if (t.length <= MAX_EXTRACTION_CHARS && t.length < 800) {
    return t;
  }
  const sentences = t
    .split(/(?<=[.!?。…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const picked = sentences.filter(sentenceMatchesExtraction);
  if (picked.length >= 2) {
    const merged = picked.join(" ");
    return merged.length <= MAX_EXTRACTION_CHARS
      ? merged
      : merged.slice(0, MAX_EXTRACTION_CHARS);
  }
  return t.length <= MAX_EXTRACTION_CHARS ? t : t.slice(0, MAX_EXTRACTION_CHARS);
}

/**
 * 너무 길면 키워드 문장 위주로 잘라 분석용 short 텍스트 생성.
 */
export function buildShortAnalysisTranscript(cleaned: string): string {
  if (cleaned.length <= MAX_ANALYSIS_CHARS) {
    return cleaned;
  }

  const sentences = cleaned
    .split(/(?<=[.!?。…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const picked = sentences.filter((s) => KEYWORD_LINE.test(s));
  if (picked.length >= 4) {
    const merged = picked.join(" ");
    if (merged.length <= MAX_SHORT_OUTPUT) return merged;
    return merged.slice(0, MAX_SHORT_OUTPUT);
  }

  const head = cleaned.slice(0, 3200);
  const tail = cleaned.slice(-2400);
  return `${head}\n…\n${tail}`;
}

export interface PreparedAnalysisInput {
  /** 반복 제거된 전체 (DB 저장, 마스킹 없음) */
  cleaned: string;
  /** 마스킹·노이즈 정규화 후 전체 (재시도용) */
  maskedNormalized: string;
  /** 견적 휴리스틱 추출 전용 (키워드 문장 우선, 길이 상한) */
  extractionInput: string;
  /** LLM에 실제로 넣는 텍스트 (짧은 통화는 masked 전체, 긴 통화는 키워드 축약) */
  analysisInput: string;
}

/**
 * 원본 STT → 반복 제거 → 마스킹 → 추출용 축약 → (길면) 분석용 축약.
 * 견적 필드는 `extractionInput`에서 먼저 추출한다.
 */
export function prepareAnalysisInput(rawTranscript: string): PreparedAnalysisInput {
  const cleaned = cleanTranscriptRepetition(rawTranscript);
  const maskedNormalized = maskAndNormalizeForAnalysis(cleaned);
  const extractionInput = buildExtractionFocusedText(maskedNormalized);
  const analysisInput = buildShortAnalysisTranscript(maskedNormalized);
  return { cleaned, maskedNormalized, extractionInput, analysisInput };
}

/**
 * `cleanTranscript()` 등으로 이미 정리된 본문 → 마스킹·축약만 수행 (중복 반복 제거 없음).
 */
export function prepareAnalysisInputFromCleaned(
  cleaned: string,
): PreparedAnalysisInput {
  const maskedNormalized = maskAndNormalizeForAnalysis(cleaned);
  const extractionInput = buildExtractionFocusedText(maskedNormalized);
  const analysisInput = buildShortAnalysisTranscript(maskedNormalized);
  return { cleaned, maskedNormalized, extractionInput, analysisInput };
}

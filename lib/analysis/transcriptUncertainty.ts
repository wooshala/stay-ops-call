import type { AnalysisResult } from "@/lib/analysis/schema";
import type { PendingEventType } from "@/lib/integrations/buildStructuredPendingSummary";

export type TranscriptUncertaintyWarning =
  | "short_audio"
  | "test_call"
  | "repetitive_transcript"
  | "short_transcript"
  | "stt_hallucination_suspected";

export type TranscriptUncertaintyAssessment = {
  isUncertain: boolean;
  warnings: TranscriptUncertaintyWarning[];
  /** OpsInbox context.warning — primary warning */
  primaryWarning: TranscriptUncertaintyWarning | null;
  skipLlm: boolean;
  stage: "stt_completed" | "stt_uncertain";
  confidence: number;
  primaryIntent: AnalysisResult["primary_intent"];
  /** structured summary 2nd line */
  detailSummary: string;
  /** structured summary 1st line */
  typeLabel: string;
  eventType: PendingEventType;
};

const SHORT_AUDIO_SEC = 15;
const SHORT_TRANSCRIPT_CHARS = 40;
const HALLUCINATION_CHARS_PER_SEC = 12;

/** STT 환각에 자주 끼어드는 일반어 — 숙박 의도로 보지 않음 */
const LODGING_KEYWORD =
  /예약|숙박|체크인|체크아웃|입실|퇴실|객실|투숙|요금|가격|스탠다드|디럭스|연장|취소|환불|대실|침대|조식|주차|견적|단체|\d{2,4}호|룸|호실|내일\s*밤|모레|인원|성인|아동/;

function splitSegments(transcript: string): string[] {
  return transcript
    .split(/[.!?。…]\s*|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 4);
}

function isRepetitiveTranscript(transcript: string): boolean {
  const segments = splitSegments(transcript);
  if (segments.length < 2) return false;

  const seen = new Map<string, number>();
  for (const seg of segments) {
    const key = seg.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const count of seen.values()) {
    if (count >= 2) return true;
  }

  const unique = seen.size;
  return unique / segments.length < 0.55;
}

function hasMeaningfulLodgingKeyword(transcript: string): boolean {
  return LODGING_KEYWORD.test(transcript);
}

function isTestLikeTranscript(transcript: string): boolean {
  return /테스트|test/i.test(transcript) && !hasMeaningfulLodgingKeyword(transcript);
}

function isSuspectedHallucination(
  transcript: string,
  durationSec: number | null | undefined,
): boolean {
  if (durationSec == null || durationSec <= 0) return false;
  if (durationSec >= SHORT_AUDIO_SEC) return false;
  const maxExpected = Math.max(30, durationSec * HALLUCINATION_CHARS_PER_SEC);
  return transcript.trim().length > maxExpected;
}

function buildUncertainResult(
  warnings: TranscriptUncertaintyWarning[],
  detailSummary: string,
  primaryIntent: AnalysisResult["primary_intent"],
  confidence: number,
  typeLabel: string,
  eventType: PendingEventType,
): TranscriptUncertaintyAssessment {
  return {
    isUncertain: true,
    warnings,
    primaryWarning: warnings[0] ?? null,
    skipLlm: true,
    stage: "stt_uncertain",
    confidence,
    primaryIntent,
    detailSummary,
    typeLabel,
    eventType,
  };
}

/**
 * STT 직후 통화 신뢰도 판정. 불확실하면 LLM·예약/컴플레인 분류를 보류한다.
 */
export function assessTranscriptUncertainty(input: {
  transcript: string;
  durationSec?: number | null;
}): TranscriptUncertaintyAssessment | null {
  const transcript = input.transcript.trim();
  if (!transcript) return null;

  const warnings: TranscriptUncertaintyWarning[] = [];
  const durationSec = input.durationSec;

  if (durationSec != null && durationSec > 0 && durationSec < SHORT_AUDIO_SEC) {
    warnings.push("short_audio");
  }

  if (isTestLikeTranscript(transcript)) {
    warnings.push("test_call");
  }

  if (isRepetitiveTranscript(transcript)) {
    warnings.push("repetitive_transcript");
  }

  if (transcript.length < SHORT_TRANSCRIPT_CHARS) {
    warnings.push("short_transcript");
  }

  if (isSuspectedHallucination(transcript, durationSec)) {
    warnings.push("stt_hallucination_suspected");
  }

  if (warnings.length === 0) return null;

  if (warnings.includes("short_audio")) {
    return buildUncertainResult(
      warnings,
      "통화 내용이 짧아 자동 분석이 불확실합니다.",
      "manual_review_required",
      0.15,
      "분석 불확실",
      "service_request",
    );
  }

  if (warnings.includes("test_call")) {
    return buildUncertainResult(
      warnings,
      "테스트성 통화로 보입니다.",
      "test_or_unclear",
      0.2,
      "테스트·내용 불명",
      "service_request",
    );
  }

  if (
    warnings.includes("repetitive_transcript") ||
    warnings.includes("stt_hallucination_suspected")
  ) {
    return buildUncertainResult(
      warnings,
      "통화 내용이 반복되거나 STT 결과가 불안정해 자동 분석을 보류했습니다.",
      "manual_review_required",
      0.2,
      "분석 불확실",
      "service_request",
    );
  }

  return buildUncertainResult(
    warnings,
    "통화 내용이 짧아 자동 분석이 불확실합니다.",
    "manual_review_required",
    0.15,
    "분석 불확실",
    "service_request",
  );
}

export function buildUncertainAnalysisResult(
  assessment: TranscriptUncertaintyAssessment,
  transcriptPreview?: string,
): AnalysisResult {
  const preview =
    transcriptPreview?.trim().slice(0, 120) ||
    assessment.detailSummary;

  return {
    summary: assessment.detailSummary,
    primary_intent: assessment.primaryIntent,
    secondary_tags: [
      "stt_uncertain",
      ...assessment.warnings.map((w) => `warn_${w}`),
    ],
    confidence: assessment.confidence,
    entities: {
      room_no: null,
      guest_name: null,
      issue_type: null,
      item_requested: null,
      quantity: null,
      unit: null,
      arrival_eta: null,
      occupancy_count: null,
      checkin_date: null,
      checkout_date: null,
      quoted_price: null,
      complaint_reason: null,
      amount: null,
      payment_method: null,
      payment_deposit: null,
      group_booking: null,
      room_count: null,
      room_type: null,
      deposit_amount: null,
      parking_count: null,
    },
    reservation_staff: null,
    missing_fields: [],
    follow_up_questions: [],
    recommended_actions: [
      {
        action_type: "manual_review",
        title: "통화 내용 수동 확인",
        description: `자동 분류를 보류했습니다. STT: ${preview}`,
        priority: "low",
      },
    ],
  };
}

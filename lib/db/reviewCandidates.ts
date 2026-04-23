import { getServiceSupabase } from "@/lib/supabase/server";
import { getReviewPolicy } from "@/lib/utils/reviewPolicy";
import {
  MODEL_VERSION,
  PROMPT_VERSION,
  HEURISTIC_VERSION,
} from "@/lib/analysis/versions";
import type { AnalysisResult } from "@/lib/analysis/schema";

export type CandidateSource = "batch" | "upload" | "reanalyze";
type CandidateReason = "low_confidence" | "needs_review" | "rule_match" | "high_risk_rule" | "random_sample";

interface WorkflowResult {
  createdType: string | null;
  skipped?: boolean;
}

interface CreateCandidateInput {
  callId: string;
  analysisResult: Pick<AnalysisResult, "primary_intent" | "summary" | "confidence" | "entities">;
  workflowResult: WorkflowResult;
  source: CandidateSource;
}

const RANDOM_SAMPLE_RATE = 0.08; // 8%

function resolveReasons(
  analysisResult: CreateCandidateInput["analysisResult"],
  workflowResult: WorkflowResult,
): CandidateReason[] {
  const reasons: CandidateReason[] = [];
  const policy = getReviewPolicy(analysisResult.confidence);

  if (policy.decision === "low_confidence") reasons.push("low_confidence");
  if (policy.decision === "needs_review") reasons.push("needs_review");

  // high_risk_rule: 날짜/예약 맥락인데 record가 생성되지 않은 경우
  const entities = analysisResult.entities as Record<string, unknown> | null | undefined;
  const hasDateHint = !!(
    entities?.checkin_date ||
    entities?.checkout_date ||
    entities?.arrival_eta
  );
  const isReservationRelated = [
    "reservation_inquiry",
    "checkin_checkout",
    "cancel_request",
    "payment",
  ].includes(analysisResult.primary_intent ?? "");
  const noRecordCreated = !workflowResult.createdType || workflowResult.skipped;

  if (hasDateHint && isReservationRelated && noRecordCreated) {
    reasons.push("high_risk_rule");
  }

  // rule_match: 예약 관련 의도인데 normal로 통과된 경우에도 날짜 있으면 포함
  if (hasDateHint && policy.decision === "normal" && isReservationRelated) {
    reasons.push("rule_match");
  }

  // random_sample
  if (reasons.length === 0 && Math.random() < RANDOM_SAMPLE_RATE) {
    reasons.push("random_sample");
  }

  return reasons;
}

/**
 * 분석+워크플로 완료 후 호출.
 * 후보 생성 조건에 해당하면 INSERT, 아니면 no-op.
 * call당 open(pending) candidate는 1개만 유지한다.
 */
export async function createReviewCandidateIfNeeded(
  input: CreateCandidateInput,
): Promise<void> {
  const { callId, analysisResult, workflowResult, source } = input;
  const reasons = resolveReasons(analysisResult, workflowResult);
  if (reasons.length === 0) return;

  const supabase = getServiceSupabase();

  // 중복 방지: 이미 pending candidate가 있으면 생성하지 않는다
  const { data: existing } = await supabase
    .from("review_candidates")
    .select("id")
    .eq("call_id", callId)
    .eq("review_status", "pending")
    .maybeSingle();

  if (existing) return;

  await supabase.from("review_candidates").insert({
    call_id: callId,
    review_job_id: null,
    original_intent: analysisResult.primary_intent ?? null,
    original_summary: analysisResult.summary ?? null,
    original_confidence: analysisResult.confidence ?? null,
    model_version: MODEL_VERSION,
    prompt_version: PROMPT_VERSION,
    heuristic_version: HEURISTIC_VERSION,
    source,
    reason_json: reasons,
    review_status: "pending",
    review_priority_score: reasons.includes("high_risk_rule") ? 100
      : reasons.includes("low_confidence") ? 80
      : reasons.includes("needs_review") ? 60
      : reasons.includes("rule_match") ? 40
      : 10,
    predicted_call_type: analysisResult.primary_intent ?? null,
    intent_score: analysisResult.confidence ?? null,
  });
}

type AutoDecision = "pass" | "reject" | "review";

export type AutoDecisionInput = {
  primary_intent: string | null;
  confidence: number | null;
  analysis_confidence: number | null;
  entity_checkin_date: string | null;
  entity_people_count: number | null;
  transcript_text: string | null;
};

export function computeAutoScore(call: AutoDecisionInput): number {
  let score = 0;
  if (call.primary_intent) score += 0.3;

  const conf = call.confidence ?? call.analysis_confidence ?? 0;
  if (conf >= 0.9) score += 0.3;
  else if (conf >= 0.8) score += 0.2;
  else if (conf >= 0.7) score += 0.1;

  if (call.entity_checkin_date) score += 0.2;
  if (call.entity_people_count) score += 0.1;
  if ((call.transcript_text?.length ?? 0) > 30) score += 0.1;
  return Math.min(score, 1);
}

export function decideAuto(call: AutoDecisionInput): AutoDecision {
  const score = computeAutoScore(call);
  const transcriptLen = call.transcript_text?.length ?? 0;
  if (score >= 0.8) return "pass";
  if (transcriptLen < 10 || !call.primary_intent) return "reject";
  return "review";
}

export function getClusterKey(input: {
  primary_intent: string | null;
  checkin_date: string | null;
}): string {
  const intent = (input.primary_intent ?? "none").trim() || "none";
  const checkin = (input.checkin_date ?? "none").trim() || "none";
  return `${intent}_${checkin}`;
}


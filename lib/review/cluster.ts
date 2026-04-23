import { cleanTranscript } from "@/lib/analysis/cleanTranscript";
import type { CallRow } from "@/lib/types/database";

const PREFIX_LEN = 30;

/**
 * 규칙 기반 클러스터 키: cleaned transcript 앞부분 + 예측 call_type(primary_intent).
 */
export function buildClusterKey(call: CallRow): string {
  const raw = call.transcript_text ?? "";
  const cleaned = cleanTranscript(raw).replace(/\s+/g, " ").trim();
  const prefix = cleaned.slice(0, PREFIX_LEN) || "_";
  const intent = (call.primary_intent ?? "unknown").trim() || "unknown";
  return `${prefix}|${intent}`;
}

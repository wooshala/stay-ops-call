import { cleanTranscript } from "@/lib/analysis/cleanTranscript";
import { applyAnalysisHeuristics } from "@/lib/analysis/heuristics";
import { fallbackAnalysisResult } from "@/lib/analysis/fallback";
import {
  buildShortTranscriptAnalysisResult,
} from "@/lib/analysis/manualReview";
import { runAnalysisLLM } from "@/lib/analysis/runLLM";
import type { AnalysisResult } from "@/lib/analysis/schema";
import {
  deleteEntitiesForCall,
  getCallById,
  insertCallEntity,
  insertRecommendations,
  markCallQueuedForAnalyzeRetry,
  tryUpdateCallAutoReview,
  tryUpdateCallAnalysisFailed,
  tryUpdateCallAnalysisPreTexts,
  tryUpdateCallAnalysisProcessing,
  tryUpdateCallAnalysisSkipped,
  tryUpdateCallAnalysisSuccess,
  type AnalysisPersistLevelDb,
} from "@/lib/db/calls";
import { extractQuotationFromText } from "@/lib/quotation/extract";
import { mergeQuotationIntoEntities } from "@/lib/quotation/merge";
import { buildQuoteDraftFromExtracted } from "@/lib/quotation/quoteDraft";
import { shouldSkipTranscriptForAnalysis } from "@/lib/transcript/shortTranscript";
import { prepareAnalysisInputFromCleaned } from "@/lib/transcript/preprocess";
import { deleteRecommendationsForCall } from "@/lib/db/recommendations";
import { updatePhoneContactAfterAnalysis } from "@/lib/db/phoneContacts";
import { resolveRoomNo } from "@/lib/utils/roomNo";
import { computeAutoScore, decideAuto, getClusterKey } from "@/lib/review/autoDecision";

const ANALYSIS_SCHEMA_VERSION = "1";
const MAX_RAW_RESPONSE_CHARS = 100_000;
const MAX_ERROR_CHARS = 1800;
const DEBUG_LLM_RESPONSE = process.env.DEBUG_LLM_RESPONSE === "1";

export type RunAnalysisResult =
  | {
      ok: true;
      analysis: AnalysisResult;
      persistLevel?: AnalysisPersistLevelDb;
    }
  | { ok: false; error: string; code?: string };

function truncateForDb(s: string): string {
  if (s.length <= MAX_RAW_RESPONSE_CHARS) return s;
  return `${s.slice(0, MAX_RAW_RESPONSE_CHARS)}…[truncated]`;
}

function truncateForLog(s: string, max = 2500): string {
  const t = s ?? "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…[truncated:${t.length}]`;
}

type AnalysisFailStage =
  | "stt"
  | "transcript_cleaning"
  | "llm_call"
  | "llm_json_parse"
  | "db_write"
  | "analysis_exception";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableDbWriteError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("fetch failed") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("EAI_AGAIN")
  );
}

function compactErrorForDb(e: unknown, stage: AnalysisFailStage): string {
  const rawBase =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : (() => {
            try {
              return JSON.stringify(e);
            } catch {
              return String(e);
            }
          })();
  const base = rawBase || "Unknown error";
  const stackRaw = e instanceof Error ? (e.stack ?? "") : "";
  const stack = stackRaw
    .split("\n")
    .slice(0, 3)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ");
  const text = stack
    ? `[${stage}] ${base} | ${stack}`
    : `[${stage}] ${base}`;
  if (text.length <= MAX_ERROR_CHARS) return text;
  return `${text.slice(0, MAX_ERROR_CHARS)}…[truncated]`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseNaturalDateToIso(
  raw: string | null | undefined,
  baseDate = new Date(),
): { iso: string | null; warning: string | null } {
  const v = (raw ?? "").trim();
  if (!v) return { iso: null, warning: null };

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { iso: v, warning: null };
  }

  if (v === "오늘") {
    return { iso: toIsoDate(baseDate), warning: null };
  }
  if (v === "내일") {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return { iso: toIsoDate(d), warning: null };
  }
  if (v === "모레") {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    return { iso: toIsoDate(d), warning: null };
  }

  const md = v.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const y = baseDate.getFullYear();
      const cand = new Date(y, month - 1, day);
      if (
        cand.getMonth() === month - 1 &&
        cand.getDate() === day
      ) {
        return { iso: toIsoDate(cand), warning: null };
      }
    }
  }

  return {
    iso: null,
    warning: `date_unparsed:${v}`,
  };
}

/**
 * LLM 분석 + 엔티티 저장 + 추천 액션 + phone_contacts 갱신.
 */
export async function runAnalysisForCall(
  callId: string,
  options?: {
    useTranscriptCleaned?: boolean;
    /** 배치 검수 파이프라인: batch_job_id 없이 분석 저장 금지 */
    requireBatchJobId?: boolean;
  },
): Promise<RunAnalysisResult> {
  const call = await getCallById(callId);
  if (!call) {
    return { ok: false, error: "Call not found" };
  }

  if (options?.requireBatchJobId === true) {
    const bid = call.batch_job_id?.trim();
    if (!bid) {
      await tryUpdateCallAnalysisFailed(callId, "batch_job_id missing", {
        code: "missing_batch_job",
      });
      return { ok: false, error: "batch_job_id missing" };
    }
  }

  const useCleaned =
    options?.useTranscriptCleaned === true &&
    Boolean(call.transcript_cleaned?.trim());
  const rawTranscript = call.transcript_text?.trim();
  const cleanedStored = call.transcript_cleaned?.trim();

  if (!useCleaned && !rawTranscript) {
    const msg = "No transcript yet. Run STT first.";
    await tryUpdateCallAnalysisFailed(callId, msg, { code: "no_transcript" });
    return { ok: false, error: msg };
  }
  if (useCleaned && !cleanedStored) {
    const msg =
      "transcript_cleaned가 없습니다. 먼저 저장하거나 원문 분석을 사용하세요.";
    await tryUpdateCallAnalysisFailed(callId, msg, { code: "no_transcript_cleaned" });
    return {
      ok: false,
      error: msg,
    };
  }

  let failStage: AnalysisFailStage = "analysis_exception";
  try {
    const processingOk = await tryUpdateCallAnalysisProcessing(callId);
    if (!processingOk) {
      console.warn(
        "[analysis] analysis_status=processing not persisted; continuing",
      );
    }

    failStage = "transcript_cleaning";
    const domainCleaned = useCleaned
      ? cleanedStored!
      : cleanTranscript(rawTranscript!);
    const { cleaned, maskedNormalized, extractionInput, analysisInput } =
      prepareAnalysisInputFromCleaned(domainCleaned);

    if (shouldSkipTranscriptForAnalysis(domainCleaned)) {
      await tryUpdateCallAnalysisPreTexts(callId, {
        transcript_cleaned: cleaned || null,
        analysis_input_text: analysisInput || null,
      });
      await deleteEntitiesForCall(callId);
      await deleteRecommendationsForCall(callId);

      const shortSummary = domainCleaned.slice(0, 120) || "짧은 통화";
      const data = buildShortTranscriptAnalysisResult(shortSummary);
      const persistLevel = await tryUpdateCallAnalysisSkipped(callId, {
        summary: data.summary,
        primary_intent: data.primary_intent,
        secondary_tags: data.secondary_tags,
        analysis_confidence: data.confidence,
        analysis_version: ANALYSIS_SCHEMA_VERSION,
        transcript_cleaned: cleaned || null,
        analysis_input_text: analysisInput || null,
      });

      return { ok: true, analysis: data, persistLevel };
    }

    const quotationExtraction = extractQuotationFromText(extractionInput);
    const preOk = await tryUpdateCallAnalysisPreTexts(callId, {
      transcript_cleaned: cleaned || null,
      analysis_input_text: analysisInput || null,
    });
    if (!preOk) {
      console.warn(
        "[analysis] transcript_cleaned/analysis_input_text not persisted; LLM continues with in-memory text",
      );
    }

    const attempts: string[] =
      analysisInput === maskedNormalized
        ? [maskedNormalized]
        : [analysisInput, maskedNormalized];

    let data: AnalysisResult | null = null;
    let llmOk = true;
    let rawLlm = "";
    let textUsed = analysisInput;

    let llmLastReason: "api_error" | "json_parse" | null = null;
    for (let i = 0; i < attempts.length; i++) {
      const t = attempts[i]!;
      failStage = "llm_call";
      const llm = await runAnalysisLLM(t);
      if (DEBUG_LLM_RESPONSE) {
        const rawPreview = truncateForLog(llm.raw ?? "", 2500);
        if (llm.ok) {
          const keys = Object.keys(llm.data as Record<string, unknown>);
          const hasSummary =
            typeof llm.data.summary === "string" &&
            llm.data.summary.trim().length > 0;
          console.log("[llm-debug] ok", {
            callId,
            attempt: i + 1,
            attempts: attempts.length,
            hasSummary,
            keys,
          });
        } else {
          console.log("[llm-debug] not_ok", {
            callId,
            attempt: i + 1,
            attempts: attempts.length,
            reason: llm.reason,
          });
        }
        console.log("[llm-debug] raw", { callId, attempt: i + 1, rawPreview });
      }
      if (llm.raw) rawLlm = llm.raw;
      if (llm.ok) {
        data = llm.data;
        llmOk = true;
        textUsed = t;
        if (t !== analysisInput) {
          const ok = await tryUpdateCallAnalysisPreTexts(callId, {
            transcript_cleaned: cleaned || null,
            analysis_input_text: t || null,
          });
          if (!ok) {
            console.warn(
              "[analysis] post-retry analysis_input_text not persisted",
            );
          }
        }
        break;
      }
      llmLastReason = llm.reason;
    }

    if (!data) {
      failStage = llmLastReason === "json_parse" ? "llm_json_parse" : "llm_call";
      const lastText = attempts[attempts.length - 1] ?? maskedNormalized;
      data = fallbackAnalysisResult(lastText);
      llmOk = false;
      textUsed = lastText;
      const ok = await tryUpdateCallAnalysisPreTexts(callId, {
        transcript_cleaned: cleaned || null,
        analysis_input_text: textUsed || null,
      });
      if (!ok) {
        console.warn(
          "[analysis] fallback 후 pre-texts not persisted",
        );
      }
    }

    data.entities = mergeQuotationIntoEntities(
      data.entities,
      quotationExtraction,
      textUsed,
    );
    data = applyAnalysisHeuristics(data, textUsed);

    const roomNo = resolveRoomNo({
      llmRoomNo: data.entities.room_no,
      transcript: textUsed,
      roomNoHint: call.room_no_hint,
    });

    failStage = "db_write";
    let persistLevel: AnalysisPersistLevelDb = "none";
    let checkinNorm = parseNaturalDateToIso(data.entities.checkin_date ?? null);
    let checkoutNorm = parseNaturalDateToIso(data.entities.checkout_date ?? null);
    let quoteDraft: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await deleteEntitiesForCall(callId);
        await deleteRecommendationsForCall(callId);

        checkinNorm = parseNaturalDateToIso(data.entities.checkin_date ?? null);
        checkoutNorm = parseNaturalDateToIso(data.entities.checkout_date ?? null);
        const dateWarnings = [checkinNorm.warning, checkoutNorm.warning].filter(
          (w): w is string => Boolean(w),
        );

        await insertCallEntity({
          call_id: callId,
          room_no: roomNo,
          guest_name: data.entities.guest_name ?? null,
          issue_type: data.entities.issue_type ?? null,
          item_requested: data.entities.item_requested ?? null,
          quantity: data.entities.quantity ?? null,
          unit: data.entities.unit ?? null,
          arrival_eta: data.entities.arrival_eta ?? null,
          occupancy_count: data.entities.occupancy_count ?? null,
          checkin_date: checkinNorm.iso,
          checkout_date: checkoutNorm.iso,
          quoted_price: data.entities.quoted_price ?? null,
          complaint_reason: data.entities.complaint_reason ?? null,
          amount: data.entities.amount ?? null,
          payment_method: data.entities.payment_method ?? null,
          payment_deposit: data.entities.payment_deposit ?? null,
          group_booking: data.entities.group_booking ?? null,
          room_count: data.entities.room_count ?? null,
          deposit_amount: data.entities.deposit_amount ?? null,
          parking_count: data.entities.parking_count ?? null,
          extracted_json: {
            ...data.entities,
            checkin_date_raw: data.entities.checkin_date ?? null,
            checkout_date_raw: data.entities.checkout_date ?? null,
            checkin_date: checkinNorm.iso,
            checkout_date: checkoutNorm.iso,
            date_parse_warnings: dateWarnings,
            room_no: roomNo,
            quotation_extraction: quotationExtraction,
          } as Record<string, unknown>,
        });

        quoteDraft = buildQuoteDraftFromExtracted(
          {
            ...data.entities,
            room_no: roomNo,
          } as Record<string, unknown>,
          quotationExtraction,
        );

        await insertRecommendations(
          callId,
          data.recommended_actions.map((a) => ({
            action_type: a.action_type,
            title: a.title,
            description: a.description ?? null,
            priority: a.priority,
          })),
        );

        const rawPersist = truncateForDb(
          rawLlm || JSON.stringify({ merged: data }),
        );
        persistLevel = await tryUpdateCallAnalysisSuccess(callId, {
          summary: data.summary,
          primary_intent: data.primary_intent,
          secondary_tags: data.secondary_tags,
          actionable_secondary_intents: data.actionable_secondary_intents ?? null,
          analysis_confidence: data.confidence,
          quote_draft: quoteDraft || null,
          analysis_raw_response: rawPersist,
          analysis_version: ANALYSIS_SCHEMA_VERSION,
          llmOk,
        });
        break;
      } catch (e) {
        if (!isRetryableDbWriteError(e) || attempt >= 3) {
          throw e;
        }
        const backoffMs = 250 * Math.pow(2, attempt - 1);
        console.warn("[analysis] db_write retry", {
          callId,
          attempt,
          backoffMs,
          error: e instanceof Error ? e.message : String(e),
        });
        await sleep(backoffMs);
      }
    }

    if (persistLevel === "none") {
      console.warn(
        "[analysis] calls row not updated after analysis; entities/recommendations were written",
      );
    }

    if (llmOk) {
      const autoInput = {
        primary_intent: data.primary_intent ?? null,
        confidence: data.confidence ?? null,
        analysis_confidence: data.confidence ?? null,
        entity_checkin_date: checkinNorm.iso,
        entity_people_count: data.entities.occupancy_count ?? null,
        transcript_text: textUsed ?? null,
      };
      const autoScore = computeAutoScore(autoInput);
      const autoDecision = decideAuto(autoInput);
      const clusterId = getClusterKey({
        primary_intent: data.primary_intent ?? null,
        checkin_date: checkinNorm.iso,
      });
      const transition =
        autoDecision === "pass"
          ? { review_status: "verified" as const, label_status: "human_verified" as const }
          : autoDecision === "reject"
            ? { review_status: "rejected" as const, label_status: "auto" as const }
            : { review_status: "needs_review" as const, label_status: "auto" as const };
      await tryUpdateCallAutoReview(callId, {
        auto_score: autoScore,
        auto_decision: autoDecision,
        cluster_id: clusterId,
        ...transition,
      });
    }

    const refreshed = await getCallById(callId);
    if (
      refreshed?.normalized_phone &&
      (refreshed.source_type === "external" ||
        refreshed.source_type === "smartcall")
    ) {
      await updatePhoneContactAfterAnalysis({
        normalized_phone: refreshed.normalized_phone,
        last_intent: data.primary_intent,
        last_summary: data.summary,
      });
    }

    return { ok: true, analysis: data, persistLevel };
  } catch (e) {
    const codeMap: Record<AnalysisFailStage, string> = {
      stt: "stt_failed",
      transcript_cleaning: "transcript_cleaning_failed",
      llm_call: "llm_call_failed",
      llm_json_parse: "llm_json_parse_failed",
      db_write: "analysis_db_write_failed",
      analysis_exception: "analysis_exception",
    };
    const code = codeMap[failStage] ?? "analysis_exception";
    const msg = compactErrorForDb(e, failStage);
    console.error("[analysis] unexpected", e);
    if (failStage === "db_write" && code === "analysis_db_write_failed" && isRetryableDbWriteError(e)) {
      const okQueued = await markCallQueuedForAnalyzeRetry(callId, code, msg);
      if (!okQueued) {
        console.warn("[analysis] analysis_status=queued not persisted");
      }
      return { ok: false, error: msg, code };
    }

    const ok = await tryUpdateCallAnalysisFailed(callId, msg, { code });
    if (!ok) console.warn("[analysis] analysis_status=failed not persisted");
    return { ok: false, error: msg, code };
  }
}

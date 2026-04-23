import type { AnalysisResult } from "@/lib/analysis/schema";
import {
  getCallById,
  getCallDetailBundle,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowSkipped,
} from "@/lib/db/calls";
import { maybeCreateReservationDraftFromAnalysis } from "@/lib/db/reservationDrafts";
import { createReviewCandidateIfNeeded, type CandidateSource } from "@/lib/db/reviewCandidates";
import { runAnalysisForCall } from "@/lib/pipeline/runAnalysisForCall";
import {
  createWorkflowFromCall,
  type WorkflowCreateOutcome,
} from "@/lib/workflows/createWorkflowFromCall";

export type CallAnalyzePipelineResult =
  | {
      ok: true;
      analysis: AnalysisResult;
      workflow: WorkflowCreateOutcome;
      bundle: Awaited<ReturnType<typeof getCallDetailBundle>>;
    }
  | { ok: false; notFound?: boolean; error: string };

export async function executeCallAnalyzePipeline(
  callId: string,
  opts: { useTranscriptCleaned?: boolean; source?: CandidateSource },
): Promise<CallAnalyzePipelineResult> {
  const call = await getCallById(callId);
  if (!call) {
    return { ok: false, notFound: true, error: "Not found" };
  }

  const an = await runAnalysisForCall(callId, {
    useTranscriptCleaned: opts.useTranscriptCleaned === true,
  });
  if (!an.ok) {
    return { ok: false, error: an.error ?? "Analyze failed" };
  }

  const wf = await createWorkflowFromCall(callId, an.analysis);
  if (!wf.ok) {
    await markWorkflowFailed(callId, "workflow_failed", wf.error ?? "");
  } else if (wf.createdType === null) {
    await markWorkflowSkipped(callId);
  } else {
    await markWorkflowCompleted(callId);
  }

  await createReviewCandidateIfNeeded({
    callId,
    analysisResult: an.analysis,
    workflowResult: { createdType: wf.ok ? wf.createdType : null, skipped: wf.ok && wf.createdType === null },
    source: opts.source ?? "reanalyze",
  });

  await maybeCreateReservationDraftFromAnalysis({
    callId,
    analysis: an.analysis,
    workflow: wf,
  });

  const bundle = await getCallDetailBundle(callId);
  return { ok: true, analysis: an.analysis, workflow: wf, bundle };
}

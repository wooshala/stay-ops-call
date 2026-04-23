"use server";

import { executeCallAnalyzePipeline } from "@/lib/api/callAnalyzePipeline";
import { executeCallWorkflowOnly } from "@/lib/api/callWorkflowTrigger";

export async function triggerCallAnalyze(
  callId: string,
  useTranscriptCleaned = false,
): Promise<void> {
  const r = await executeCallAnalyzePipeline(callId, { useTranscriptCleaned });
  if (!r.ok) {
    if (r.notFound) throw new Error("Not found");
    throw new Error(r.error);
  }
}

export async function triggerCallWorkflow(callId: string): Promise<void> {
  const wf = await executeCallWorkflowOnly(callId);
  if (!wf.ok) {
    throw new Error(wf.error ?? "Workflow failed");
  }
}

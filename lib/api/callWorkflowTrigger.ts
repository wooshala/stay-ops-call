import {
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowSkipped,
} from "@/lib/db/calls";
import {
  createWorkflowFromCall,
  type WorkflowCreateOutcome,
} from "@/lib/workflows/createWorkflowFromCall";

/**
 * workflow-only 재실행: operation/service/lead upsert 후 calls.workflow_* 상태를 갱신한다.
 */
export async function executeCallWorkflowOnly(
  callId: string,
): Promise<WorkflowCreateOutcome> {
  const wf = await createWorkflowFromCall(callId);
  if (!wf.ok) {
    await markWorkflowFailed(callId, "workflow_failed", wf.error ?? "");
  } else if (wf.createdType === null) {
    await markWorkflowSkipped(callId);
  } else {
    await markWorkflowCompleted(callId);
  }
  return wf;
}

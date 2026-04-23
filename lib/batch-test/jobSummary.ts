import type { BatchJobRow, BatchJobItemRow } from "@/lib/types/database";
import type { BatchPipelineMode, BatchRunSummary } from "@/lib/batch-test/types";
import { analysisStatusIsUsableForWorkflow } from "@/lib/db/calls";

/**
 * DB에 저장된 job / item으로 요약 (폴링 응답용, 가벼운 필드만 사용).
 */
export function summarizeBatchJobFromItems(
  job: BatchJobRow,
  items: BatchJobItemRow[],
  pipeline: BatchPipelineMode,
): BatchRunSummary {
  const done = items.filter(
    (i) => i.status === "completed" || i.status === "failed",
  );

  const intentDistribution: Record<string, number> = {};
  for (const i of done) {
    if (i.primary_intent?.trim()) {
      const k = i.primary_intent.trim();
      intentDistribution[k] = (intentDistribution[k] ?? 0) + 1;
    }
  }

  let roomEligible = 0;
  let roomWith = 0;
  for (const i of done) {
    if (analysisStatusIsUsableForWorkflow(i.analysis_status)) {
      roomEligible++;
      if (i.room_no != null && String(i.room_no).trim() !== "") {
        roomWith++;
      }
    }
  }

  const roomRate =
    roomEligible > 0 ? Math.round((roomWith / roomEligible) * 1000) / 10 : null;

  let wfEligible = 0;
  let wfRecord = 0;
  let wfStepOk = 0;

  if (pipeline === "full") {
    for (const i of done) {
      if (analysisStatusIsUsableForWorkflow(i.analysis_status)) {
        wfEligible++;
        const stepOk = i.error_stage !== "workflow";
        if (stepOk) wfStepOk++;
        if (i.workflow_type && i.workflow_type !== "none") wfRecord++;
      }
    }
  }

  const wfStepRate =
    wfEligible > 0 ? Math.round((wfStepOk / wfEligible) * 1000) / 10 : null;
  const wfRecordRate =
    wfEligible > 0 ? Math.round((wfRecord / wfEligible) * 1000) / 10 : null;

  return {
    pipeline,
    total: job.total_count,
    successCount: job.success_count,
    failureCount: job.failed_count,
    intentDistribution,
    roomNo: {
      eligible: roomEligible,
      withRoomNo: roomWith,
      ratePercent: roomRate,
    },
    workflow: {
      eligible: wfEligible,
      createdRecord: wfRecord,
      stepSuccess: wfStepOk,
      recordRatePercent: wfRecordRate,
      stepRatePercent: wfStepRate,
    },
  };
}

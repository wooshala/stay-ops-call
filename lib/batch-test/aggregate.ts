import type { BatchPipelineMode, BatchRunSummary, BatchTestRow } from "@/lib/batch-test/types";

export function isBatchRowSuccess(
  r: BatchTestRow,
  pipeline: BatchPipelineMode,
): boolean {
  if (r.error_stage != null) return false;
  if (!r.upload_ok || !r.stt_ok) return false;
  if (pipeline === "stt") return true;
  if (!r.analysis_ok || r.analysis_skipped) return false;
  if (pipeline === "stt_analysis") return true;
  return r.workflow_ok && !r.workflow_skipped;
}

/**
 * 배치 결과 집계 (품질·비용 검증용).
 */
export function aggregateBatchResults(
  rows: BatchTestRow[],
  pipeline: BatchPipelineMode,
): BatchRunSummary {
  let successCount = 0;
  let failureCount = 0;
  const intentDistribution: Record<string, number> = {};

  let roomEligible = 0;
  let roomWith = 0;

  let wfEligible = 0;
  let wfRecord = 0;
  let wfStepOk = 0;

  for (const r of rows) {
    if (isBatchRowSuccess(r, pipeline)) successCount++;
    else failureCount++;

    if (r.analysis_ok && !r.analysis_skipped && r.primary_intent) {
      const k = r.primary_intent;
      intentDistribution[k] = (intentDistribution[k] ?? 0) + 1;
    }

    if (r.analysis_ok && !r.analysis_skipped) {
      roomEligible++;
      if (r.room_no != null && String(r.room_no).trim() !== "") {
        roomWith++;
      }
    }

    if (pipeline === "full" && r.analysis_ok && !r.analysis_skipped) {
      wfEligible++;
      if (r.workflow_ok && !r.workflow_skipped) {
        wfStepOk++;
        if (r.workflow_type !== "none") wfRecord++;
      }
    }
  }

  const roomRate =
    roomEligible > 0 ? Math.round((roomWith / roomEligible) * 1000) / 10 : null;

  const wfStepRate =
    wfEligible > 0 ? Math.round((wfStepOk / wfEligible) * 1000) / 10 : null;
  const wfRecordRate =
    wfEligible > 0 ? Math.round((wfRecord / wfEligible) * 1000) / 10 : null;

  return {
    pipeline,
    total: rows.length,
    successCount,
    failureCount,
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

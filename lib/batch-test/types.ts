export type BatchWorkflowType =
  | "operation_case"
  | "service_request"
  | "reservation_lead"
  | "none";

export type BatchErrorStage = "upload" | "stt" | "analysis" | "workflow";

/** 비용 보호: STT만 / STT+분석 / 전체(워크플로 포함) */
export type BatchPipelineMode = "stt" | "stt_analysis" | "full";

export interface BatchTestRow {
  fileName: string;
  call_id: string | null;
  upload_ok: boolean;
  stt_ok: boolean;
  analysis_ok: boolean;
  workflow_ok: boolean;
  /** pipeline이 분석·워크플로를 건너뛸 때 true */
  analysis_skipped: boolean;
  workflow_skipped: boolean;
  pipeline_mode: BatchPipelineMode;
  primary_intent: string | null;
  room_no: string | null;
  summary: string | null;
  workflow_type: BatchWorkflowType;
  error_stage: BatchErrorStage | null;
  error_message: string | null;
}

export interface BatchRunSummary {
  pipeline: BatchPipelineMode;
  total: number;
  successCount: number;
  failureCount: number;
  intentDistribution: Record<string, number>;
  roomNo: {
    eligible: number;
    withRoomNo: number;
    ratePercent: number | null;
  };
  workflow: {
    eligible: number;
    createdRecord: number;
    stepSuccess: number;
    recordRatePercent: number | null;
    stepRatePercent: number | null;
  };
}

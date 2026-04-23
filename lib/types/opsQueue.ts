export type OpsQueueType = "failed" | "review" | "retry";

export type OpsQueueItem = {
  id: string;
  source_file_name: string | null;
  primary_intent: string | null;
  summary: string | null;
  analysis_status: string | null;
  workflow_status: string | null;
  workflow_error_code: string | null;
  workflow_error_message: string | null;
  analysis_confidence: number | null;
  created_at: string | null;
  updated_at: string | null;
};

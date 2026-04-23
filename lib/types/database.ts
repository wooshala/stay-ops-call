export type CallDirection = "inbound" | "outbound";
export type CallSourceType = "internal" | "external" | "smartcall" | "android_agent";
export type HandlingStatus =
  | "new"
  | "in_progress"
  | "done"
  | "need_property_reply"
  | "waiting_customer"
  | "follow_up_needed";
export type SttStatus = "pending" | "processing" | "completed" | "failed";
export type AnalysisStatus =
  | "queued"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  /** 핵심 필드만 DB에 반영됨(일부 컬럼 스키마 불일치 등) */
  | "partial"
  /** 분석은 끝났으나 DB 보조 필드 저장 실패 등 주의 필요 */
  | "warning";
export type UploadStatus = "uploaded" | "failed";

export interface CallRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  phone_number: string | null;
  normalized_phone: string | null;
  direction: CallDirection | null;
  source_type: CallSourceType | null;
  room_no_hint: string | null;
  recording_path: string | null;
  recording_url: string | null;
  upload_status: UploadStatus | null;
  stt_status: SttStatus | null;
  analysis_status: AnalysisStatus | null;
  transcript_text: string | null;
  /** 반복 제거 등 전처리 STT (원본은 transcript_text) */
  transcript_cleaned: string | null;
  /** 실제 분석에 사용한 텍스트 (긴 통화 시 키워드 추출본) */
  analysis_input_text: string | null;
  summary: string | null;
  primary_intent: string | null;
  secondary_tags: unknown;
  /** 분석 보강: primary 외 업무적으로 연관된 의도(워크플로 미생성, 참고용) */
  actionable_secondary_intents: unknown;
  stt_confidence: number | null;
  analysis_confidence: number | null;
  stt_provider: string | null;
  stt_error_message: string | null;
  analysis_error_message: string | null;
  /** 009 이후; 미적용 DB에서는 누락될 수 있음 */
  analysis_error_code?: string | null;
  analysis_raw_response?: string | null;
  analysis_version?: string | null;
  /** 010 이후: full | partial_db | minimal | none */
  analysis_persist_level?: string | null;
  /** 자동 생성 견적서 초안 */
  quote_draft: string | null;
  note: string | null;
  /** 배치 테스트 등으로 생성 시 소속 배치 잡 */
  batch_job_id?: string | null;
  /** 업로드 폴더 기준 원본 파일명 */
  source_file_name?: string | null;
  /** 파일 중복 방지용 fingerprint */
  file_fingerprint?: string | null;
  /** 원본 파일 크기(KB) */
  file_size_kb?: number | null;
  /** UI 표준 confidence */
  confidence?: number | null;
  /** 자동 검수 점수(0~1) */
  auto_score?: number | null;
  /** 자동 검수 의사결정(pass|reject|review) */
  auto_decision?: "pass" | "reject" | "review" | null;
  /** 클러스터 키(intent_date) */
  cluster_id?: string | null;
  /** 검수 상태(raw/needs_review/verified/rejected) */
  review_status?: "raw" | "needs_review" | "verified" | "rejected" | null;
  /** 라벨 상태(none/auto/human_verified) */
  label_status?: "none" | "auto" | "human_verified" | null;
  /** 검수 완료 시각 */
  reviewed_at?: string | null;
  /** 검수자 식별자 */
  reviewed_by?: string | null;
  /** workflow 생성 상태 (031 이후; analysis_status와 독립) */
  workflow_status?: "pending" | "running" | "completed" | "failed" | "skipped" | null;
  workflow_error_code?: string | null;
  workflow_error_message?: string | null;
  workflow_attempts?: number | null;
  workflow_last_attempt_at?: string | null;
  workflow_completed_at?: string | null;
  /** 038 이후: 콜 처리 큐 운영 필드 */
  handling_status?: HandlingStatus | null;
  manual_classification?: string | null;
  assignee?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  handled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallActivityLogRow {
  id: string;
  call_id: string;
  event_type: string;
  actor: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CallEntityRow {
  id: string;
  call_id: string;
  room_no: string | null;
  guest_name: string | null;
  issue_type: string | null;
  item_requested: string | null;
  quantity: number | null;
  unit: string | null;
  arrival_eta: string | null;
  occupancy_count: number | null;
  checkin_date: string | null;
  checkout_date: string | null;
  quoted_price: number | null;
  complaint_reason: string | null;
  amount: number | null;
  payment_method: string | null;
  payment_deposit: boolean | null;
  group_booking: boolean | null;
  room_count: number | null;
  deposit_amount: number | null;
  parking_count: number | null;
  extracted_json: unknown;
  created_at: string;
}

export interface ActionRecommendationRow {
  id: string;
  call_id: string;
  action_type: string | null;
  title: string;
  description: string | null;
  status: "suggested" | "confirmed" | "dismissed";
  priority: "low" | "normal" | "high";
  created_at: string;
}

export interface PhoneContactRow {
  id: string;
  phone_number: string;
  normalized_phone: string;
  name: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  total_calls: number | null;
  inbound_calls: number | null;
  outbound_calls: number | null;
  last_intent: string | null;
  last_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperationCaseRow {
  id: string;
  call_id: string;
  room_no: string | null;
  case_type: string | null;
  issue_type: string | null;
  title: string;
  description: string | null;
  severity: "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  channel_type?: string | null;
  source_confidence?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequestRow {
  id: string;
  call_id: string;
  room_no: string | null;
  request_type: string | null;
  item_requested: string | null;
  quantity: number | null;
  unit: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface ReservationLeadRow {
  id: string;
  call_id: string;
  phone_number: string | null;
  normalized_phone: string | null;
  lead_type: string | null;
  guest_name: string | null;
  room_no: string | null;
  arrival_eta: string | null;
  occupancy_count: number | null;
  quoted_price: number | null;
  title: string;
  description: string | null;
  status: "new" | "contacted" | "converted" | "lost";
  created_at: string;
  updated_at: string;
}

export type BatchJobStatus = "queued" | "running" | "completed" | "failed";
export type BatchJobItemStatus = "queued" | "running" | "completed" | "failed";

export interface BatchJobRow {
  id: string;
  /** 표시용 이름 (미설정 시 UI에서 pipeline·일시로 대체) */
  name: string | null;
  /** 워커가 오디오를 읽는 디렉터리(없으면 BATCH_TEST_FIXTURES_DIR 등 기본값) */
  upload_root?: string | null;
  status: BatchJobStatus;
  pipeline: string;
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BatchJobItemRow {
  id: string;
  batch_job_id: string;
  file_name: string;
  status: BatchJobItemStatus;
  call_id: string | null;
  stt_status: string | null;
  analysis_status: string | null;
  analysis_persist_level?: string | null;
  primary_intent: string | null;
  room_no: string | null;
  workflow_type: string | null;
  error_stage: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewLogRow {
  id: string;
  call_id: string;
  action: string;
  before_json: unknown | null;
  after_json: unknown | null;
  created_at: string;
  created_by: string | null;
}

export type ReviewJobStatus =
  | "draft"
  | "imported"
  | "analyzing"
  | "analyzed"
  | "candidates_ready"
  | "clustered"
  | "labeling";

export type ReviewCandidateStatus = "pending" | "skipped" | "labeled";

export interface ReviewJobRow {
  id: string;
  title: string;
  source_batch_job_id: string | null;
  status: ReviewJobStatus;
  created_at: string;
  updated_at: string;
}

export interface ReviewCandidateRow {
  id: string;
  review_job_id: string;
  call_id: string;
  review_priority_score: number;
  cluster_key: string | null;
  predicted_call_type: string | null;
  intent_score: number | null;
  is_fallback: boolean;
  review_status: ReviewCandidateStatus;
  is_representative: boolean;
  /** 가중치 항목별 부분 점수 */
  reason_json: Record<string, number> | null;
  created_at: string;
}

export interface ReviewClusterRow {
  id: string;
  review_job_id: string;
  cluster_key: string;
  representative_candidate_id: string | null;
  sample_count: number;
}

export interface ReviewLabelRow {
  id: string;
  candidate_id: string;
  final_call_type: string | null;
  final_summary: string | null;
  final_price_mentioned: boolean | null;
  final_date_mentioned: boolean | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
}

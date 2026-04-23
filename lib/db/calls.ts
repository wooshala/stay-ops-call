import { randomUUID } from "crypto";

import { getServiceSupabase } from "@/lib/supabase/server";
import { isMissingColumnOrRelationError } from "@/lib/supabase/columnError";
import type {
  ActionRecommendationRow,
  CallEntityRow,
  CallRow,
  OperationCaseRow,
  ReservationLeadRow,
  ServiceRequestRow,
} from "@/lib/types/database";
import { fetchWorkflowsForCall } from "@/lib/db/workflows";
import { normalizePhone } from "@/lib/utils/phone";

export interface ListCallsParams {
  intent?: string | null;
  phone?: string | null;
  room_no?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listCalls(
  params: ListCallsParams,
): Promise<{ rows: CallRow[]; total: number }> {
  const supabase = getServiceSupabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("calls")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.intent) {
    q = q.eq("primary_intent", params.intent);
  }
  const np = params.phone ? normalizePhone(params.phone) : null;
  if (np) {
    q = q.eq("normalized_phone", np);
  }
  if (params.room_no) {
    const safe = params.room_no.replace(/%/g, "\\%");
    q = q.ilike("room_no_hint", `%${safe}%`);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) {
    console.error("[calls] list error", error);
    throw error;
  }
  return { rows: (data ?? []) as CallRow[], total: count ?? 0 };
}

/**
 * transcript_text / transcript_cleaned 수동 수정. STT는 재실행하지 않음.
 */
export async function tryUpdateCallTranscripts(
  id: string,
  patch: {
    transcript_text?: string | null;
    transcript_cleaned?: string | null;
  },
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("calls").update(patch).eq("id", id);
  if (error) {
    warnPersist("tryUpdateCallTranscripts", error);
    return false;
  }
  return true;
}

/**
 * 견적 초안(JSON string) 수동 저장.
 */
export async function tryUpdateCallQuoteDraft(
  id: string,
  quoteDraftJson: string | null,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      quote_draft: quoteDraftJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    warnPersist("tryUpdateCallQuoteDraft", error);
    return false;
  }
  return true;
}

export async function getBatchJobIdForCall(
  callId: string,
): Promise<string | null> {
  const call = await getCallById(callId);
  if (call?.batch_job_id) return call.batch_job_id;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("batch_job_items")
    .select("batch_job_id")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[calls] getBatchJobIdForCall", error);
    return null;
  }
  const row = data as { batch_job_id: string } | null;
  return row?.batch_job_id ?? null;
}

export async function getCallById(id: string): Promise<CallRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[calls] get error", error);
    throw error;
  }
  return data as CallRow | null;
}

export async function getCallDetailBundle(callId: string): Promise<{
  call: CallRow;
  entities: CallEntityRow[];
  recommendations: ActionRecommendationRow[];
  operation_case: OperationCaseRow | null;
  service_request: ServiceRequestRow | null;
  reservation_lead: ReservationLeadRow | null;
} | null> {
  const call = await getCallById(callId);
  if (!call) return null;

  const supabase = getServiceSupabase();
  const [entRes, recRes, wf] = await Promise.all([
    supabase.from("call_entities").select("*").eq("call_id", callId),
    supabase
      .from("action_recommendations")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: true }),
    fetchWorkflowsForCall(callId),
  ]);

  if (entRes.error) throw entRes.error;
  if (recRes.error) throw recRes.error;

  return {
    call,
    entities: (entRes.data ?? []) as CallEntityRow[],
    recommendations: (recRes.data ?? []) as ActionRecommendationRow[],
    operation_case: wf.operation_case,
    service_request: wf.service_request,
    reservation_lead: wf.reservation_lead,
  };
}

export async function deleteEntitiesForCall(callId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("call_entities")
    .delete()
    .eq("call_id", callId);
  if (error) {
    console.error("[call_entities] delete error", error);
    throw error;
  }
}

export async function insertCallEntity(input: {
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
  extracted_json: Record<string, unknown>;
}): Promise<void> {
  const supabase = getServiceSupabase();
  const fullRow = {
    call_id: input.call_id,
    room_no: input.room_no,
    guest_name: input.guest_name,
    issue_type: input.issue_type,
    item_requested: input.item_requested,
    quantity: input.quantity,
    unit: input.unit,
    arrival_eta: input.arrival_eta,
    occupancy_count: input.occupancy_count,
    checkin_date: input.checkin_date,
    checkout_date: input.checkout_date,
    quoted_price: input.quoted_price,
    complaint_reason: input.complaint_reason,
    amount: input.amount,
    payment_method: input.payment_method,
    payment_deposit: input.payment_deposit,
    group_booking: input.group_booking,
    room_count: input.room_count,
    deposit_amount: input.deposit_amount,
    parking_count: input.parking_count,
    extracted_json: input.extracted_json,
  };

  const attempts: Array<Record<string, unknown>> = [
    fullRow,
    // payment/quotation 확장 컬럼 미적용 DB 폴백
    {
      call_id: fullRow.call_id,
      room_no: fullRow.room_no,
      guest_name: fullRow.guest_name,
      issue_type: fullRow.issue_type,
      item_requested: fullRow.item_requested,
      quantity: fullRow.quantity,
      unit: fullRow.unit,
      arrival_eta: fullRow.arrival_eta,
      occupancy_count: fullRow.occupancy_count,
      checkin_date: fullRow.checkin_date,
      checkout_date: fullRow.checkout_date,
      quoted_price: fullRow.quoted_price,
      complaint_reason: fullRow.complaint_reason,
      extracted_json: fullRow.extracted_json,
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const row = attempts[i]!;
    const { error } = await supabase.from("call_entities").insert(row);
    if (!error) return;
    if (!isMissingColumnOrRelationError(error) || i === attempts.length - 1) {
      console.error("[call_entities] insert error", error);
      throw error;
    }
    console.warn(
      `[call_entities] insert fallback ${i + 1}/${attempts.length}`,
      error.message,
    );
  }
}

export async function insertRecommendations(
  callId: string,
  items: Array<{
    action_type: string;
    title: string;
    description?: string | null;
    priority: "low" | "normal" | "high";
  }>,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = getServiceSupabase();
  const rows = items.map((i) => ({
    call_id: callId,
    action_type: i.action_type,
    title: i.title,
    description: i.description ?? null,
    priority: i.priority,
    status: "suggested" as const,
  }));
  const { error } = await supabase.from("action_recommendations").insert(rows);
  if (error) {
    console.error("[action_recommendations] insert error", error);
    throw error;
  }
}

export interface CreateCallInput {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  phone_number: string | null;
  normalized_phone: string | null;
  direction: CallRow["direction"];
  source_type: CallRow["source_type"];
  room_no_hint: string | null;
  recording_path: string | null;
  recording_url: string | null;
  note: string | null;
  batch_job_id?: string | null;
  source_file_name?: string | null;
  file_fingerprint?: string | null;
}

export async function createCallRecord(input: CreateCallInput): Promise<CallRow> {
  const supabase = getServiceSupabase();
  const fullInsert = {
    id: input.id,
    started_at: input.started_at,
    ended_at: input.ended_at,
    duration_sec: input.duration_sec,
    phone_number: input.phone_number,
    normalized_phone: input.normalized_phone,
    direction: input.direction,
    source_type: input.source_type,
    room_no_hint: input.room_no_hint,
    recording_path: input.recording_path,
    recording_url: input.recording_url,
    note: input.note,
    batch_job_id: input.batch_job_id ?? null,
    source_file_name: input.source_file_name ?? null,
    file_fingerprint: input.file_fingerprint ?? null,
    upload_status: "uploaded",
    stt_status: "pending",
    analysis_status: "queued",
  };
  const { data, error } = await supabase
    .from("calls")
    .insert(fullInsert)
    .select("*")
    .single();

  if (!error) {
    return data as CallRow;
  }
  if (!isMissingColumnOrRelationError(error)) {
    console.error("[calls] create error", error);
    throw error;
  }

  // Legacy DB 호환: source_file_name 컬럼이 없는 경우 최소 필드로 재시도
  const { source_file_name: _drop, ...compatInsert } = fullInsert;
  const compat = await supabase.from("calls").insert(compatInsert).select("*").single();
  if (compat.error) {
    console.error("[calls] create compat error", compat.error);
    throw compat.error;
  }
  return compat.data as CallRow;
}

/**
 * 파일 검수 배치 전용 단일 생성 경로.
 * calls 기반 파이프라인에서 batch_job_id/source_file_name을 강제한다.
 */
export async function createCallForBatch(input: {
  batch_job_id: string;
  source_file_name: string;
}): Promise<CallRow> {
  const batchId = input.batch_job_id?.trim();
  const sourceName = input.source_file_name?.trim();
  if (!batchId) throw new Error("batch_job_id is required");
  if (!sourceName) throw new Error("source_file_name is required");
  return createCallRecord({
    id: randomUUID(),
    started_at: null,
    ended_at: null,
    duration_sec: null,
    phone_number: null,
    normalized_phone: null,
    direction: "inbound",
    source_type: "internal",
    room_no_hint: null,
    recording_path: null,
    recording_url: null,
    note: `file-review: ${sourceName}`,
    batch_job_id: batchId,
    source_file_name: sourceName,
  });
}

/**
 * 배치 항목이 calls 행 없이 끝나는 경우 복구: batch_job_id가 붙은 failed 행을 만든다.
 */
export async function createFailedCallForBatchItem(input: {
  batchJobId: string;
  sourceFileName: string;
  message: string;
  code?: string | null;
}): Promise<string | null> {
  const id = randomUUID();
  try {
    await createCallRecord({
      id,
      started_at: null,
      ended_at: null,
      duration_sec: null,
      phone_number: null,
      normalized_phone: null,
      direction: "inbound",
      source_type: "internal",
      room_no_hint: null,
      recording_path: null,
      recording_url: null,
      note: `batch recovery: ${input.sourceFileName}`,
      batch_job_id: input.batchJobId,
      source_file_name: input.sourceFileName,
    });
  } catch (e) {
    console.error("[calls] createFailedCallForBatchItem create", e);
    return null;
  }
  const ok = await tryUpdateCallAnalysisFailed(id, input.message, {
    code: input.code ?? "batch_item_failed",
  });
  if (!ok) {
    console.warn("[calls] createFailedCallForBatchItem failed persist", id);
  }
  return id;
}

export async function updateCallRecording(
  id: string,
  patch: { recording_path: string | null; recording_url: string | null },
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      recording_path: patch.recording_path,
      recording_url: patch.recording_url,
    })
    .eq("id", id);
  if (error) {
    console.error("[calls] update recording error", error);
    throw error;
  }
}

export async function updateCallSttProcessing(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({ stt_status: "processing", stt_error_message: null })
    .eq("id", id);
  if (error) throw error;
}

export async function updateCallSttSuccess(
  id: string,
  patch: {
    transcript_text: string;
    stt_confidence: number | null;
    stt_provider: string;
  },
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      transcript_text: patch.transcript_text,
      stt_confidence: patch.stt_confidence,
      stt_provider: patch.stt_provider,
      stt_status: "completed",
      stt_error_message: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function updateCallSttFailed(
  id: string,
  message: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      stt_status: "failed",
      stt_error_message: message,
    })
    .eq("id", id);
  if (error) throw error;
}

function warnPersist(context: string, error: unknown): void {
  console.warn(`[calls] ${context}`, error);
}

/** 워크플로·후속 처리에 쓸 수 있는 분석 완료 상태 */
export function analysisStatusIsUsableForWorkflow(
  status: string | null | undefined,
): boolean {
  return (
    status === "completed" ||
    status === "partial" ||
    status === "warning"
  );
}

/**
 * 분석 시작 표시. 실패해도 파이프라인은 계속 진행(경고만).
 */
export async function tryUpdateCallAnalysisProcessing(
  id: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({ analysis_status: "processing", analysis_error_message: null })
    .eq("id", id);
  if (error) {
    warnPersist("tryUpdateCallAnalysisProcessing", error);
    return false;
  }
  return true;
}

/**
 * 전처리 텍스트 저장. 컬럼 누락 시 부분 패치로 재시도.
 */
export async function tryUpdateCallAnalysisPreTexts(
  id: string,
  patch: {
    transcript_cleaned: string | null;
    analysis_input_text: string | null;
  },
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const attempts: Array<{
    transcript_cleaned: string | null;
    analysis_input_text: string | null;
  }> = [
    patch,
    {
      transcript_cleaned: patch.transcript_cleaned,
      analysis_input_text: null,
    },
    {
      transcript_cleaned: null,
      analysis_input_text: patch.analysis_input_text,
    },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { error } = await supabase
      .from("calls")
      .update(attempts[i]!)
      .eq("id", id);
    if (!error) return true;
    warnPersist(`tryUpdateCallAnalysisPreTexts step ${i + 1}/${attempts.length}`, error);
  }
  return false;
}

export interface CallAnalysisSuccessPatch {
  summary: string;
  primary_intent: string;
  secondary_tags: unknown;
  actionable_secondary_intents: unknown;
  analysis_confidence: number;
  quote_draft: string | null;
  analysis_raw_response?: string | null;
  analysis_version?: string | null;
  /** false: LLM JSON 실패 후 휴리스틱 fallback — calls에는 warning + llm_parse_fallback */
  llmOk?: boolean;
}

/** 운영/배치 표시용 — calls 행에 `analysis_persist_level`로 저장 */
export type AnalysisPersistLevelDb =
  | "full"
  | "partial_db"
  | "minimal"
  | "none";

function persistLevelFromLayer(row: Record<string, unknown>): AnalysisPersistLevelDb {
  const p = row.analysis_persist_level;
  if (p === "full" || p === "partial_db" || p === "minimal" || p === "none") {
    return p;
  }
  const st = row.analysis_status;
  if (st === "completed") return "full";
  if (st === "partial") return "partial_db";
  if (st === "warning") return "minimal";
  return "full";
}

/**
 * 분석 결과를 calls에 저장. 스키마 불일치 시 필드를 줄여 재시도.
 */
export async function tryUpdateCallAnalysisSuccess(
  id: string,
  patch: CallAnalysisSuccessPatch,
): Promise<AnalysisPersistLevelDb> {
  const supabase = getServiceSupabase();

  const llmParsOk = patch.llmOk !== false;
  const primaryStatus = llmParsOk ? "completed" : "warning";
  const primaryErrCode = llmParsOk ? null : "llm_parse_fallback";
  const primaryErrMsg = llmParsOk
    ? null
    : "LLM JSON이 스키마와 맞지 않아 휴리스틱 보정 결과를 저장했습니다.";

  const layers: Record<string, unknown>[] = [
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      actionable_secondary_intents: patch.actionable_secondary_intents,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      quote_draft: patch.quote_draft,
      analysis_status: primaryStatus,
      analysis_error_message: primaryErrMsg,
      analysis_error_code: primaryErrCode,
      analysis_raw_response: patch.analysis_raw_response ?? null,
      analysis_version: patch.analysis_version ?? null,
      analysis_persist_level: "full",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      actionable_secondary_intents: patch.actionable_secondary_intents,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      quote_draft: patch.quote_draft,
      analysis_status: primaryStatus,
      analysis_error_message: primaryErrMsg,
      analysis_error_code: primaryErrCode,
      analysis_raw_response: patch.analysis_raw_response ?? null,
      analysis_version: patch.analysis_version ?? null,
      analysis_persist_level: "full",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      actionable_secondary_intents: patch.actionable_secondary_intents,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      quote_draft: patch.quote_draft,
      analysis_status: primaryStatus,
      analysis_error_message: primaryErrMsg,
      analysis_error_code: primaryErrCode,
      analysis_persist_level: "full",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      quote_draft: patch.quote_draft,
      analysis_status: primaryStatus,
      analysis_error_message: primaryErrMsg,
      analysis_error_code: primaryErrCode,
      analysis_persist_level: "full",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      actionable_secondary_intents: patch.actionable_secondary_intents,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      analysis_status: primaryStatus,
      analysis_error_message: primaryErrMsg,
      analysis_error_code: primaryErrCode,
      analysis_persist_level: "full",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      actionable_secondary_intents: patch.actionable_secondary_intents,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      analysis_status: "partial",
      analysis_error_message:
        "일부 필드 저장 생략(스키마·권한 확인). 핵심 분석은 반영됨.",
      analysis_persist_level: "partial_db",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      analysis_status: "partial",
      analysis_error_message:
        "최소 필드만 저장됨(견적 초안 등 누락 가능). 스키마를 확인하세요.",
      analysis_persist_level: "minimal",
      review_status: "needs_review",
      label_status: "auto",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      analysis_status: "warning",
      analysis_error_message:
        "calls 행 갱신 최소 성공. call_entities 등 하위 테이블은 별도 확인.",
      analysis_persist_level: "minimal",
      review_status: "needs_review",
      label_status: "auto",
    },
  ];

  for (let i = 0; i < layers.length; i++) {
    const row = layers[i]!;
    const { error } = await supabase.from("calls").update(row).eq("id", id);
    if (!error) {
      return persistLevelFromLayer(row);
    }
    warnPersist(`tryUpdateCallAnalysisSuccess layer ${i + 1}/${layers.length}`, error);
  }

  const { error: lastErr } = await supabase
    .from("calls")
    .update({
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      analysis_confidence: patch.analysis_confidence,
      confidence: patch.analysis_confidence,
      analysis_status: "warning",
      analysis_error_message: "calls 분석 필드 저장 실패",
      analysis_error_code: "DB_PERSIST_NONE",
      analysis_persist_level: "none",
      review_status: "needs_review",
      label_status: "auto",
    })
    .eq("id", id);
  if (!lastErr) {
    return "none";
  }
  warnPersist("tryUpdateCallAnalysisSuccess final none", lastErr);
  return "none";
}

export interface CallAnalysisSkippedPatch {
  summary: string;
  primary_intent: string;
  secondary_tags: unknown;
  analysis_confidence: number;
  analysis_version: string | null;
  transcript_cleaned: string | null;
  analysis_input_text: string | null;
}

/**
 * 짧은 STT 등 LLM 생략 시. `analysis_status = warning`, `analysis_error_code = short_transcript`.
 */
export async function tryUpdateCallAnalysisSkipped(
  id: string,
  patch: CallAnalysisSkippedPatch,
): Promise<AnalysisPersistLevelDb> {
  const supabase = getServiceSupabase();
  const layers: Record<string, unknown>[] = [
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      analysis_confidence: patch.analysis_confidence,
      analysis_version: patch.analysis_version,
      transcript_cleaned: patch.transcript_cleaned,
      analysis_input_text: patch.analysis_input_text,
      analysis_status: "warning",
      analysis_error_code: "short_transcript",
      analysis_error_message:
        "공백 제외 5자 미만 또는 인사 수준 문장으로 LLM 분석을 생략했습니다.",
      quote_draft: null,
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      analysis_confidence: patch.analysis_confidence,
      analysis_version: patch.analysis_version,
      transcript_cleaned: patch.transcript_cleaned,
      analysis_input_text: patch.analysis_input_text,
      analysis_status: "warning",
      analysis_error_code: "short_transcript",
      analysis_error_message:
        "공백 제외 5자 미만 또는 인사 수준 문장으로 LLM 분석을 생략했습니다.",
      quote_draft: null,
      analysis_persist_level: "full",
    },
    {
      summary: patch.summary,
      primary_intent: patch.primary_intent,
      secondary_tags: patch.secondary_tags,
      analysis_confidence: patch.analysis_confidence,
      analysis_version: patch.analysis_version,
      analysis_status: "warning",
      analysis_error_code: "short_transcript",
      analysis_error_message:
        "짧은 통화로 분석 생략(warning 상태 fallback).",
      analysis_persist_level: "full",
    },
  ];

  for (let i = 0; i < layers.length; i++) {
    const row = layers[i]!;
    const { error } = await supabase.from("calls").update(row).eq("id", id);
    if (!error) {
      return persistLevelFromLayer(row);
    }
    warnPersist(`tryUpdateCallAnalysisSkipped layer ${i + 1}/${layers.length}`, error);
  }
  return "none";
}

/**
 * 분석 실패 표시. 실패 시 경고만 남김.
 */
export async function tryUpdateCallAnalysisFailed(
  id: string,
  message: string,
  options?: { code?: string | null },
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const code =
    options?.code != null && String(options.code).trim() !== ""
      ? String(options.code).trim()
      : "analysis_error";
  const full: Record<string, unknown> = {
    analysis_status: "failed",
    analysis_error_message: message,
    analysis_error_code: code,
  };
  const { error } = await supabase.from("calls").update(full).eq("id", id);
  if (error) {
    warnPersist("tryUpdateCallAnalysisFailed", error);
    const { error: e2 } = await supabase
      .from("calls")
      .update({
        analysis_status: "failed",
        analysis_error_message: message,
        analysis_error_code: code,
      })
      .eq("id", id);
    if (e2) {
      warnPersist("tryUpdateCallAnalysisFailed minimal", e2);
      return false;
    }
    return true;
  }
  return true;
}

/**
 * retry 가능한 분석 DB write 실패 시, 재처리 가능한 상태로 남긴다.
 * - analysis_status를 queued로 되돌린다 (상시 worker는 없으므로 운영자가 analyze로 재실행 가능)
 * - 마지막 오류 원인을 analysis_error_code/message에 남긴다
 */
export async function markCallQueuedForAnalyzeRetry(
  callId: string,
  code: string,
  message: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const safeCode = code?.trim() || "analysis_db_write_failed";
  const safeMessage = message?.trim() || "unknown";
  const { error } = await supabase
    .from("calls")
    .update({
      analysis_status: "queued",
      analysis_error_code: safeCode,
      analysis_error_message: safeMessage,
    })
    .eq("id", callId);
  if (error) {
    warnPersist("markCallQueuedForAnalyzeRetry", error);
    return false;
  }
  return true;
}

/**
 * 파일 검수 배치 전용 성공 마킹 단일 경로.
 * Step3/4 집계 단순화를 위해 최종 성공 상태를 completed로 고정한다.
 */
export async function markCallCompleted(callId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      analysis_status: "completed",
      analysis_error_code: null,
      analysis_error_message: null,
      review_status: "needs_review",
      label_status: "auto",
    })
    .eq("id", callId);
  if (error) {
    if (isMissingColumnOrRelationError(error)) {
      const { error: e2 } = await supabase
        .from("calls")
        .update({
          analysis_status: "completed",
          analysis_error_code: null,
          analysis_error_message: null,
        })
        .eq("id", callId);
      if (!e2) return true;
    }
    warnPersist("markCallCompleted", error);
    return false;
  }
  return true;
}

/**
 * 파일 검수 배치 전용 실패 마킹 단일 경로.
 */
export async function markCallFailed(
  callId: string,
  code: string,
  message: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const safeCode = code?.trim() || "analysis_exception";
  const safeMessage = message?.trim() || "unknown";
  const { error } = await supabase
    .from("calls")
    .update({
      analysis_status: "failed",
      analysis_error_code: safeCode,
      analysis_error_message: safeMessage,
      review_status: "needs_review",
      label_status: "auto",
    })
    .eq("id", callId);
  if (!error) return true;
  if (isMissingColumnOrRelationError(error)) {
    return tryUpdateCallAnalysisFailed(callId, safeMessage, { code: safeCode });
  }
  warnPersist("markCallFailed", error);
  return false;
}

/**
 * workflow 생성 성공 마킹. analysis_status는 건드리지 않는다.
 */
export async function markWorkflowCompleted(callId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({
      workflow_status: "completed",
      workflow_error_code: null,
      workflow_error_message: null,
      workflow_completed_at: new Date().toISOString(),
    })
    .eq("id", callId);
  if (error) {
    warnPersist("markWorkflowCompleted", error);
    return false;
  }
  return true;
}

/**
 * workflow 생성 실패 마킹. analysis_status를 덮어쓰지 않는다.
 */
export async function markWorkflowFailed(
  callId: string,
  code: string,
  message: string,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const safeCode = code?.trim() || "workflow_failed";
  const safeMessage = message?.trim() || "unknown";
  const { error } = await supabase
    .from("calls")
    .update({
      workflow_status: "failed",
      workflow_error_code: safeCode,
      workflow_error_message: safeMessage,
      workflow_last_attempt_at: new Date().toISOString(),
    })
    .eq("id", callId);
  if (error) {
    warnPersist("markWorkflowFailed", error);
    return false;
  }
  return true;
}

/**
 * workflow 스킵 마킹 (intent에 따른 라우팅 없음).
 */
export async function markWorkflowSkipped(callId: string): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("calls")
    .update({ workflow_status: "skipped" })
    .eq("id", callId);
  if (error) {
    warnPersist("markWorkflowSkipped", error);
    return false;
  }
  return true;
}

export async function tryUpdateCallAutoReview(
  callId: string,
  patch: {
    auto_score: number;
    auto_decision: "pass" | "reject" | "review";
    cluster_id: string;
    review_status?: "verified" | "rejected" | "needs_review";
    label_status?: "human_verified" | "auto";
  },
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const full: Record<string, unknown> = {
    auto_score: patch.auto_score,
    auto_decision: patch.auto_decision,
    cluster_id: patch.cluster_id,
  };
  if (patch.review_status) full.review_status = patch.review_status;
  if (patch.label_status) full.label_status = patch.label_status;

  const { error } = await supabase.from("calls").update(full).eq("id", callId);
  if (!error) return true;
  if (!isMissingColumnOrRelationError(error)) {
    warnPersist("tryUpdateCallAutoReview", error);
    return false;
  }

  const minimal: Record<string, unknown> = {};
  if (patch.review_status) minimal.review_status = patch.review_status;
  if (patch.label_status) minimal.label_status = patch.label_status;
  if (Object.keys(minimal).length === 0) return true;

  const { error: e2 } = await supabase.from("calls").update(minimal).eq("id", callId);
  if (e2) {
    warnPersist("tryUpdateCallAutoReview minimal", e2);
    return false;
  }
  return true;
}

export async function listPhoneContacts(params: {
  page?: number;
  pageSize?: number;
}): Promise<{ rows: import("@/lib/types/database").PhoneContactRow[]; total: number }> {
  const supabase = getServiceSupabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("phone_contacts")
    .select("*", { count: "exact" })
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error("[phone_contacts] list error", error);
    throw error;
  }
  return {
    rows: (data ?? []) as import("@/lib/types/database").PhoneContactRow[],
    total: count ?? 0,
  };
}

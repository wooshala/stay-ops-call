/**
 * 통화내역(30일) 원장 조회 — public.calls 를 created_at 범위로 직접 조회.
 * 목록은 transcript/recording/error 원문을 제외한 whitelist 만 반환.
 */
import { getServiceSupabase } from "@/lib/supabase/server";

export type CallHistoryListItem = {
  id: string;
  startedAt: string | null;
  createdAt: string;
  endedAt: string | null;
  direction: "inbound" | "outbound" | null;
  phoneNumber: string | null;
  normalizedPhone: string | null;
  durationSeconds: number | null;
  primaryIntent: string | null;
  summary: string | null;
  sttStatus: string | null;
  analysisStatus: string | null;
  sttConfidence: number | null;
  analysisConfidence: number | null;
};

export type CallHistoryDetail = {
  id: string;
  startedAt: string | null;
  direction: "inbound" | "outbound" | null;
  durationSeconds: number | null;
  primaryIntent: string | null;
  summary: string | null;
  transcriptText: string | null;
  sttStatus: string | null;
  analysisStatus: string | null;
  sttConfidence: number | null;
  analysisConfidence: number | null;
};

const LIST_COLUMNS =
  "id, started_at, created_at, ended_at, direction, phone_number, normalized_phone, duration_sec, primary_intent, summary, stt_status, analysis_status, stt_confidence, analysis_confidence";

const DETAIL_COLUMNS =
  "id, started_at, direction, duration_sec, primary_intent, summary, transcript_text, stt_status, analysis_status, stt_confidence, analysis_confidence";

/** 조회한 컬럼 수(진단 로그용 — 컬럼명 자체는 민감정보가 아님). */
export const LIST_COLUMN_COUNT = LIST_COLUMNS.split(",").length;

/**
 * DB 예외에서 진단에 필요한 필드만 추출.
 * supabase-js 의 PostgrestError 는 Error 를 상속하지 않는 plain object 라
 * `instanceof Error` 로는 code/message 가 잡히지 않는다.
 *
 * 전화번호·summary·transcript·recording_path·secret 은 절대 담지 않는다.
 */
export function describeDbError(e: unknown): { code: string; message: string } {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; message?: unknown };
    return {
      code: typeof o.code === "string" ? o.code : "unknown",
      message: typeof o.message === "string" ? o.message : String(e),
    };
  }
  return { code: "unknown", message: String(e) };
}

type CallRow = Record<string, unknown>;

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asDirection(v: unknown): "inbound" | "outbound" | null {
  return v === "inbound" || v === "outbound" ? v : null;
}

function toListItem(r: CallRow): CallHistoryListItem {
  return {
    id: String(r.id),
    startedAt: asString(r.started_at),
    createdAt: String(r.created_at),
    endedAt: asString(r.ended_at),
    direction: asDirection(r.direction),
    phoneNumber: asString(r.phone_number),
    normalizedPhone: asString(r.normalized_phone),
    durationSeconds: asNumber(r.duration_sec),
    primaryIntent: asString(r.primary_intent),
    summary: asString(r.summary),
    sttStatus: asString(r.stt_status),
    analysisStatus: asString(r.analysis_status),
    sttConfidence: asNumber(r.stt_confidence),
    analysisConfidence: asNumber(r.analysis_confidence),
  };
}

export async function listCallHistory(args: {
  fromIso: string;
  toIso: string;
  page: number;
  pageSize: number;
}): Promise<{
  items: CallHistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}> {
  const { fromIso, toIso, page, pageSize } = args;
  const supabase = getServiceSupabase();

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  const { data, error, count } = await supabase
    .from("calls")
    .select(LIST_COLUMNS, { count: "exact" })
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (error) throw error;

  const items = (data ?? []).map((r) => toListItem(r as CallRow));
  const total = count ?? 0;
  return {
    items,
    total,
    page,
    pageSize,
    hasNext: fromIdx + items.length < total,
  };
}

export async function getCallHistoryDetail(
  id: string,
): Promise<CallHistoryDetail | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const r = data as CallRow;
  return {
    id: String(r.id),
    startedAt: asString(r.started_at),
    direction: asDirection(r.direction),
    durationSeconds: asNumber(r.duration_sec),
    primaryIntent: asString(r.primary_intent),
    summary: asString(r.summary),
    transcriptText: asString(r.transcript_text),
    sttStatus: asString(r.stt_status),
    analysisStatus: asString(r.analysis_status),
    sttConfidence: asNumber(r.stt_confidence),
    analysisConfidence: asNumber(r.analysis_confidence),
  };
}

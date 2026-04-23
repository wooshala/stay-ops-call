import { getServiceSupabase } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";

/** 수동 예약 기록 상태 (DB check 와 동일) */
export type ReservationStatus =
  | "inquiry"
  | "tentative"
  | "confirmed"
  | "follow_up"
  | "cancelled";

/** 미확정: PMS/확정 전 위험 구간 (필터·대시보드 공통) */
export const UNCONFIRMED_STATUSES: readonly ReservationStatus[] = [
  "inquiry",
  "tentative",
  "follow_up",
];

export function isUnconfirmedStatus(status: ReservationStatus): boolean {
  return (UNCONFIRMED_STATUSES as readonly string[]).includes(status);
}

export interface ReservationLog {
  id: string;
  phone_number: string | null;
  guest_name: string | null;
  check_in_date: string;
  check_in_time: string | null;
  room_type: string | null;
  vehicle_info: string | null;
  occupancy_count: number | null;
  status: ReservationStatus;
  memo: string | null;
  pms_confirmed: boolean;
  call_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** 전화 이력 API — 통화 스니펫 */
export interface CallHistorySnippet {
  id: string;
  created_at: string;
  phone_number: string | null;
  primary_intent: string | null;
  /** calls.summary */
  summary: string | null;
}

export interface PhoneHistoryResponse {
  reservations: ReservationLog[];
  calls: CallHistorySnippet[];
  /** 해당 번호로 매칭된 통화 전체 건수(최근 N건 제한과 별개) */
  callCount: number;
}

export interface DashboardStatsPayload {
  total: number;
  unconfirmed: number;
  pms_missing: number;
  follow_up_overdue: number;
  danger_list: ReservationLog[];
}

/** 오늘 입실 + 미확정 / 추후연락 지연 / PMS 미확인 등 행 강조 */
export type ReservationRowDanger = "red" | "orange" | "yellow" | null;

export function getReservationRowDanger(
  r: ReservationLog,
  todayIsoDate: string,
): ReservationRowDanger {
  if (r.check_in_date === todayIsoDate && isUnconfirmedStatus(r.status)) return "red";
  if (r.status === "follow_up" && r.check_in_date <= todayIsoDate) return "orange";
  if (!r.pms_confirmed && r.status === "confirmed") return "yellow";
  return null;
}

export interface CreateReservationInput {
  phone_number?: string | null;
  guest_name?: string | null;
  check_in_date: string;
  check_in_time?: string | null;
  room_type?: string | null;
  vehicle_info?: string | null;
  occupancy_count?: number | null;
  status: ReservationStatus;
  memo?: string | null;
  pms_confirmed?: boolean;
  call_id?: string | null;
  created_by?: string | null;
}

export interface ListReservationsParams {
  date?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  status?: string | null;
  statuses?: string[] | null;    // 여러 status OR 검색
  pms_unconfirmed?: boolean;     // pms_confirmed=false + !cancelled
  /** inquiry + tentative + follow_up */
  unconfirmed?: boolean;
  phone?: string | null;
  only_danger?: boolean;
  q?: string | null;             // guest_name / phone / vehicle_info / memo 통합 검색
  page?: number;
  pageSize?: number;
}

/** 클라이언트: 기록자 이름 localStorage 키 (MVP) */
export const RESERVATION_RECORDER_STORAGE_KEY = "stay_ops_reservation_recorder";

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  inquiry:    "문의",
  tentative:  "구두확정",
  confirmed:  "확정",
  follow_up:  "추후연락",
  cancelled:  "취소",
};

export async function createReservation(input: CreateReservationInput): Promise<ReservationLog> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("reservation_manual_logs")
    .insert({
      ...input,
      phone_number: input.phone_number ? normalizePhone(input.phone_number) : null,
      pms_confirmed: input.pms_confirmed ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ReservationLog;
}

export async function updateReservation(
  id: string,
  patch: Partial<Omit<ReservationLog, "id" | "created_at" | "created_by">>,
): Promise<ReservationLog> {
  const supabase = getServiceSupabase();
  const update = {
    ...patch,
    phone_number: patch.phone_number ? normalizePhone(patch.phone_number) : patch.phone_number,
  };
  const { data, error } = await supabase
    .from("reservation_manual_logs")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ReservationLog;
}

export async function listReservations(
  params: ListReservationsParams,
): Promise<{ rows: ReservationLog[]; total: number }> {
  const supabase = getServiceSupabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("reservation_manual_logs")
    .select("*", { count: "exact" })
    .order("check_in_date", { ascending: false })
    .order("check_in_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (params.date) {
    q = q.eq("check_in_date", params.date);
  } else {
    if (params.date_from) q = q.gte("check_in_date", params.date_from);
    if (params.date_to)   q = q.lte("check_in_date", params.date_to);
  }

  if (params.pms_unconfirmed) {
    q = q.eq("pms_confirmed", false).neq("status", "cancelled");
  } else if (params.statuses?.length) {
    q = q.in("status", params.statuses);
  } else if (params.unconfirmed) {
    q = q.in("status", [...UNCONFIRMED_STATUSES]);
  } else if (params.status) {
    q = q.eq("status", params.status);
  }

  if (params.phone) q = q.eq("phone_number", normalizePhone(params.phone));
  if (params.only_danger) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.eq("check_in_date", today).in("status", [...UNCONFIRMED_STATUSES]);
  }

  if (params.q?.trim()) {
    const term = params.q.trim();
    const normPhone = normalizePhone(term);
    q = q.or(
      `guest_name.ilike.%${term}%,phone_number.ilike.%${normPhone}%,vehicle_info.ilike.%${term}%,memo.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as ReservationLog[], total: count ?? 0 };
}

export async function getPhoneHistory(phone: string): Promise<PhoneHistoryResponse> {
  const supabase = getServiceSupabase();
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { reservations: [], calls: [], callCount: 0 };
  }

  const orPhone =
    `phone_number.eq.${normalized},normalized_phone.eq.${normalized}`;

  const [{ data: res }, { data: callRows, count }] = await Promise.all([
    supabase
      .from("reservation_manual_logs")
      .select("*")
      .eq("phone_number", normalized)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("calls")
      .select("id, created_at, phone_number, primary_intent, summary")
      .or(orPhone)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .or(orPhone),
  ]);

  const calls: CallHistorySnippet[] = (callRows ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    phone_number: (row.phone_number as string | null) ?? null,
    primary_intent: (row.primary_intent as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
  }));

  return {
    reservations: (res ?? []) as ReservationLog[],
    calls,
    callCount: count ?? 0,
  };
}

export async function getDashboardStats(date: string): Promise<DashboardStatsPayload> {
  const supabase = getServiceSupabase();
  const today = date;

  const { data: todayRows } = await supabase
    .from("reservation_manual_logs")
    .select("*")
    .eq("check_in_date", today)
    .neq("status", "cancelled");

  const rows = (todayRows ?? []) as ReservationLog[];
  const unconfirmed = rows.filter((r) => isUnconfirmedStatus(r.status));
  const pmsMissing  = rows.filter(r => !r.pms_confirmed && r.status !== "cancelled");

  // 추후연락 중 오늘 이전 생성된 건
  const { data: overdueRows } = await supabase
    .from("reservation_manual_logs")
    .select("*")
    .eq("status", "follow_up")
    .lte("check_in_date", today);

  return {
    total:               rows.length,
    unconfirmed:         unconfirmed.length,
    pms_missing:         pmsMissing.length,
    follow_up_overdue:   (overdueRows ?? []).length,
    danger_list:         unconfirmed,
  };
}

export function hasMissingPhone(r: Pick<ReservationLog, "phone_number">): boolean {
  return r.phone_number == null || String(r.phone_number).trim() === "";
}

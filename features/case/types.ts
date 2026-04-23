export type CaseState =
  | "new"
  | "inquiry"
  | "follow_up_needed"
  | "tentative_hold"
  | "reservation_received"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "closed_lost";

export type CaseRiskLevel = "normal" | "warning" | "critical" | "blocking";

export type StayType = "stay" | "dayuse";

export type ReservationCaseRow = {
  id: string;
  call_id: string | null;
  phone_number: string | null;
  checkin_date: string | null; // ISO date (YYYY-MM-DD)
  stay_type: string | null;
  room_type: string | null;
  people_count: number | null;
  state: string;
  is_pms_registered: boolean | null;
  is_room_confirmed: boolean | null;
  is_checkin_time_confirmed: boolean | null;
  current_owner: string | null;
  next_action: string | null;
  due_at: string | null;
  is_overdue: boolean | null;
  risk_level: string | null;
  risk_code: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseEventRow = {
  id: string;
  case_id: string | null;
  type: string | null;
  message: string | null;
  created_at: string;
};

export type CaseTaskRow = {
  id: string;
  case_id: string | null;
  task_type: string | null;
  status: string | null;
  owner: string | null;
  due_at: string | null;
  created_at: string;
};

export type CaseListFilters = {
  state?: string;
  owner?: string;
  risk_level?: string;
};


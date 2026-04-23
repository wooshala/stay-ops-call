import { diffDays } from "@/features/case/lib/dates";
import type { CaseRiskLevel, ReservationCaseRow } from "@/features/case/types";

export function computeCaseRisk(caseItem: ReservationCaseRow): {
  risk_level: CaseRiskLevel;
  is_overdue: boolean;
  risk_code: string | null;
} {
  const now = new Date();
  const dueAt = caseItem.due_at ? new Date(caseItem.due_at) : null;
  const overdue = Boolean(dueAt && Number.isFinite(dueAt.getTime()) && dueAt.getTime() < now.getTime());

  const daysToCheckin = diffDays(caseItem.checkin_date, now);

  if (overdue) {
    return { risk_level: "warning", is_overdue: true, risk_code: "DUE_OVERDUE" };
  }

  if (daysToCheckin != null) {
    if (daysToCheckin <= 0 && !caseItem.is_pms_registered) {
      return { risk_level: "blocking", is_overdue: false, risk_code: "PMS_MISSING_DAY0" };
    }
    if (daysToCheckin <= 1 && !caseItem.is_room_confirmed) {
      return { risk_level: "critical", is_overdue: false, risk_code: "ROOM_NOT_CONFIRMED_D1" };
    }
  }

  return { risk_level: "normal", is_overdue: false, risk_code: null };
}


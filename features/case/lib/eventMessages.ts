export function caseEventMessage(input: {
  type: string;
  action?: string;
  owner?: string;
  checkin_date?: string | null;
  fields?: Record<string, unknown>;
}): string {
  const t = input.type;
  if (t === "created_from_call") {
    return "통화 분석 결과로 예약 케이스를 자동 생성했습니다.";
  }
  if (t === "manual_created_from_call") {
    return `운영자가 체크인 날짜를 입력해 케이스를 생성했습니다. (체크인: ${input.checkin_date ?? "-"})`;
  }
  if (t === "assign") {
    return `담당자를 지정했습니다. (담당: ${input.owner || "unassigned"})`;
  }
  if (t === "state_confirmed") {
    return "예약 케이스를 확인 상태로 전환했습니다. (confirmed)";
  }
  if (t === "state_closed_lost") {
    return "예약이 성사되지 않아 케이스를 종료했습니다. (closed_lost)";
  }
  if (t === "flag_pms") {
    return "PMS 입력 완료로 표시했습니다.";
  }
  if (t === "flag_room") {
    return "객실 확정 완료로 표시했습니다.";
  }
  if (t === "flag_checkin_time") {
    return "입실시간 확정 완료로 표시했습니다.";
  }
  if (t === "fields_updated") {
    const fields = input.fields ?? {};
    const keys = Object.keys(fields);
    if (keys.length === 0) return "케이스 정보를 수정했습니다.";
    const parts = keys.slice(0, 8).map((k) => `${k}=${String(fields[k])}`);
    const more = keys.length > 8 ? ` 외 ${keys.length - 8}개` : "";
    return `케이스 정보를 수정했습니다. (${parts.join(", ")}${more})`;
  }
  return "케이스 변경 내역이 기록되었습니다.";
}


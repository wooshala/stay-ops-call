const KOREAN_MAP: Record<string, string> = {
  "예약": "reservation",
  "예약문의": "reservation",
  "숙박문의": "stay_inquiry",
  "대실문의": "dayuse_inquiry",
};

export function normalizeIntent(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  const mapped = KOREAN_MAP[raw] ?? raw;
  return mapped
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/__+/g, "_");
}

export function isReservationIntent(intent: string | null | undefined): boolean {
  const norm = normalizeIntent(intent);
  if (!norm) return false;
  const allowed = new Set([
    "reservation",
    "booking",
    "stay_inquiry",
    "room_request",
    "dayuse_inquiry",
  ]);
  if (allowed.has(norm)) return true;
  // 초기 버전: 포함 매칭도 허용 (과도한 오탐 방지 위해 최소만)
  if (norm.includes("reservation") || norm.includes("booking")) return true;
  return false;
}


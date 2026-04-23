/**
 * PostgREST / Postgres: 존재하지 않는 컬럼·뷰 참조 시 재시도·폴백 분기용.
 */
export function isMissingColumnOrRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  const code = String(e.code ?? "");

  if (code === "42703") return true;
  if (msg.includes("column") && msg.includes("does not exist")) return true;
  if (msg.includes("could not find")) return true;
  if (msg.includes("schema cache")) return true;
  return false;
}

/** Parse optional ISO datetime string; invalid → null */
export function parseOptionalIso(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const d = Date.parse(value);
  if (Number.isNaN(d)) return null;
  return new Date(d).toISOString();
}

export function parseOptionalInt(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

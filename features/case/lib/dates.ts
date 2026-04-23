export function toIsoDateOnly(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function diffDays(isoDate: string | null, now = new Date()): number | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  const ms = d.getTime() - now.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function nowPlusHours(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  return d.toISOString();
}


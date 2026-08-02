import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("missing supabase env");
  process.exit(1);
}

/** Mirrors lib/db/callHistorySort.ts CALL_HISTORY_ORDER */
const CALL_HISTORY_ORDER = [
  { column: "started_at", options: { ascending: false, nullsFirst: false } },
  { column: "created_at", options: { ascending: false } },
  { column: "id", options: { ascending: false } },
] as const;

async function main() {
  const sb = createClient(url!, key!, { auth: { persistSession: false } });
  const from = "2026-08-01T13:00:00.000Z";
  const to = "2026-08-01T14:00:00.000Z";

  let q = sb
    .from("calls")
    .select("id, started_at, created_at")
    .gte("created_at", from)
    .lt("created_at", to);
  for (const step of CALL_HISTORY_ORDER) {
    q = q.order(step.column, { ...step.options });
  }
  const { data, error } = await q.limit(10);
  if (error) {
    console.error("QUERY_ERROR", error);
    process.exit(1);
  }

  const fmt = (iso: string | null) => {
    if (!iso) return "NULL";
    const d = new Date(iso);
    const k = new Date(d.getTime() + 9 * 3600 * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(k.getUTCMonth() + 1)}/${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}:${p(k.getUTCSeconds())}`;
  };

  console.log("LIVE_ORDER");
  for (const r of data ?? []) {
    console.log(r.id.slice(0, 8), "started", fmt(r.started_at), "created", fmt(r.created_at));
  }
  const ids = (data ?? []).map((r) => r.id.slice(0, 8));
  const iA = ids.indexOf("5ac8763e");
  const iB = ids.indexOf("e648f735");
  console.log("A_idx", iA, "B_idx", iB, "B_before_A", iB >= 0 && iA >= 0 && iB < iA);

  let qNull = sb
    .from("calls")
    .select("id, started_at, created_at")
    .gte("created_at", "2026-07-01T00:00:00.000Z")
    .lt("created_at", "2026-08-02T00:00:00.000Z");
  for (const step of CALL_HISTORY_ORDER) {
    qNull = qNull.order(step.column, { ...step.options });
  }
  const { data: wide, error: e2 } = await qNull.limit(200);
  if (e2) {
    console.error(e2);
    process.exit(1);
  }
  const firstNull = (wide ?? []).findIndex((r) => r.started_at == null);
  let lastNonNull = -1;
  (wide ?? []).forEach((r, i) => {
    if (r.started_at != null) lastNonNull = i;
  });
  console.log(
    "nulls_last_ok",
    firstNull === -1 || lastNonNull === -1 || firstNull > lastNonNull,
    "firstNull",
    firstNull,
    "lastNonNull",
    lastNonNull,
  );
}

void main();

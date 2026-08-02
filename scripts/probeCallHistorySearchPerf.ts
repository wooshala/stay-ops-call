/**
 * CALL-HISTORY-SEARCH-001 perf probe (read-only).
 * Run: node --env-file=.env.local --import tsx scripts/probeCallHistorySearchPerf.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const result = await fn();
  console.log(JSON.stringify({ label, ms: Date.now() - t0 }));
  return result;
}

async function main() {
  const url = get("NEXT_PUBLIC_SUPABASE_URL") || get("SUPABASE_URL");
  const key = get("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const from30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const from90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const to = new Date().toISOString();

  const { count: c30 } = await sb
    .from("calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from30)
    .lt("created_at", to);
  const { count: c90 } = await sb
    .from("calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from90)
    .lt("created_at", to);
  console.log(JSON.stringify({ count_30d: c30, count_90d: c90 }));

  const listCols =
    "id, started_at, created_at, phone_number, normalized_phone, primary_intent, summary";

  await timed("phone_digits_ilike", async () => {
    const { data, error, count } = await sb
      .from("calls")
      .select(listCols, { count: "exact" })
      .gte("created_at", from30)
      .lt("created_at", to)
      .or("normalized_phone.ilike.%6680%,phone_number.ilike.%6680%")
      .order("started_at", { ascending: false, nullsFirst: false })
      .range(0, 49);
    if (error) throw error;
    console.log(JSON.stringify({ phone_hits: count, page: data?.length }));
  });

  await timed("intent_ilike", async () => {
    const { count, error } = await sb
      .from("calls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from30)
      .lt("created_at", to)
      .ilike("primary_intent", "%parking%");
    if (error) throw error;
    console.log(JSON.stringify({ intent_hits: count }));
  });

  await timed("summary_ilike", async () => {
    const { count, error } = await sb
      .from("calls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from30)
      .lt("created_at", to)
      .ilike("summary", "%주차%");
    if (error) throw error;
    console.log(JSON.stringify({ summary_hits: count }));
  });

  await timed("transcript_ilike", async () => {
    const { count, error } = await sb
      .from("calls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from30)
      .lt("created_at", to)
      .ilike("transcript_text", "%주차%");
    if (error) throw error;
    console.log(JSON.stringify({ transcript_hits: count }));
  });

  await timed("combined_or_ilike", async () => {
    const term = "%주차%";
    const { data, error, count } = await sb
      .from("calls")
      .select(listCols, { count: "exact" })
      .gte("created_at", from30)
      .lt("created_at", to)
      .or(
        [
          `primary_intent.ilike.${term}`,
          `summary.ilike.${term}`,
          `transcript_text.ilike.${term}`,
          `phone_number.ilike.${term}`,
          `normalized_phone.ilike.${term}`,
        ].join(","),
      )
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 49);
    if (error) throw error;
    console.log(JSON.stringify({ combined_hits: count, page: data?.length }));
  });
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

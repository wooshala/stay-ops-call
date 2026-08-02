/**
 * CALL-HISTORY-SEARCH-002 — 10× DB search latency probe (read-only).
 * Run: node --env-file=.env.local --import tsx scripts/probeCallHistorySearchPerf10x.ts
 *
 * Does not log search query text — only labels and aggregates.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    n: sorted.length,
    median,
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
    min: sorted[0],
  };
}

async function main() {
  const url = get("NEXT_PUBLIC_SUPABASE_URL") || get("SUPABASE_URL");
  const key = get("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const from30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const to = new Date().toISOString();

  const { count: c30 } = await sb
    .from("calls")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from30)
    .lt("created_at", to);
  console.log(JSON.stringify({ count_30d: c30, note: "baseline window" }));

  const listCols =
    "id, started_at, created_at, phone_number, normalized_phone, primary_intent, summary";

  type Case = {
    label: string;
    run: () => Promise<{ total: number | null; status: "ok" | "error" }>;
  };

  const cases: Case[] = [
    {
      label: "phone_tail",
      run: async () => {
        const { count, error } = await sb
          .from("calls")
          .select(listCols, { count: "exact" })
          .gte("created_at", from30)
          .lt("created_at", to)
          .or('normalized_phone.ilike."%6680%",phone_number.ilike."%6680%"')
          .order("started_at", { ascending: false, nullsFirst: false })
          .range(0, 49);
        if (error) throw error;
        return { total: count, status: "ok" };
      },
    },
    {
      label: "summary_ko",
      run: async () => {
        const { count, error } = await sb
          .from("calls")
          .select(listCols, { count: "exact" })
          .gte("created_at", from30)
          .lt("created_at", to)
          .or(
            [
              'phone_number.ilike."%주차%"',
              'normalized_phone.ilike."%주차%"',
              'primary_intent.ilike."%주차%"',
              'summary.ilike."%주차%"',
              'transcript_text.ilike."%주차%"',
            ].join(","),
          )
          .order("started_at", { ascending: false, nullsFirst: false })
          .range(0, 49);
        if (error) throw error;
        return { total: count, status: "ok" };
      },
    },
    {
      label: "intent_en",
      run: async () => {
        const { count, error } = await sb
          .from("calls")
          .select("id", { count: "exact", head: true })
          .gte("created_at", from30)
          .lt("created_at", to)
          .ilike("primary_intent", "%parking%");
        if (error) throw error;
        return { total: count, status: "ok" };
      },
    },
    {
      label: "transcript_only_phrase",
      run: async () => {
        // Phrase chosen for probe; total may be 0 — still valid latency sample.
        const { count, error } = await sb
          .from("calls")
          .select("id", { count: "exact", head: true })
          .gte("created_at", from30)
          .lt("created_at", to)
          .ilike("transcript_text", "%투베드%");
        if (error) throw error;
        return { total: count, status: "ok" };
      },
    },
    {
      label: "zero_hits",
      run: async () => {
        const { count, error } = await sb
          .from("calls")
          .select(listCols, { count: "exact" })
          .gte("created_at", from30)
          .lt("created_at", to)
          .or(
            [
              'phone_number.ilike."%zzznomatch999%"',
              'normalized_phone.ilike."%zzznomatch999%"',
              'primary_intent.ilike."%zzznomatch999%"',
              'summary.ilike."%zzznomatch999%"',
              'transcript_text.ilike."%zzznomatch999%"',
            ].join(","),
          )
          .range(0, 49);
        if (error) throw error;
        return { total: count, status: "ok" };
      },
    },
  ];

  const report: Record<string, unknown> = {
    baseline_ms: { phone: 162, transcript: 126, combined_or: 117 },
    runs: 10,
  };

  for (const c of cases) {
    const samples: number[] = [];
    let lastTotal: number | null = null;
    let httpOk = 0;
    let err5xx = 0;
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      try {
        const r = await c.run();
        samples.push(Date.now() - t0);
        lastTotal = r.total;
        httpOk += 1;
      } catch {
        samples.push(Date.now() - t0);
        err5xx += 1;
      }
    }
    report[c.label] = {
      ...summarize(samples),
      total_last: lastTotal,
      ok: httpOk,
      err: err5xx,
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : "probe failed");
  process.exit(1);
});

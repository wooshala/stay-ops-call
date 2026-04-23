import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallRow } from "@/lib/types/database";

export type BatchCallStats = {
  total: number;
  failed: number;
  success: number;
  queued: number;
  label_ready: number;
};

export type BatchFailureAgg = {
  count: number;
  analysis_error_code: string | null;
  analysis_error_message: string | null;
};

/**
 * Step3·Step4·/api/calls 배치 통계 — 동일 정의로 UI와 API를 맞춘다.
 */
export function computeBatchCallStats(
  rows: Pick<CallRow, "analysis_status">[],
): BatchCallStats {
  const failed = rows.filter((r) => r.analysis_status === "failed").length;
  const success = rows.filter((r) =>
    ["completed", "partial", "warning"].includes(r.analysis_status ?? ""),
  ).length;
  const queued = rows.filter((r) =>
    ["queued", "pending", "processing"].includes(
      r.analysis_status ?? "",
    ),
  ).length;
  const label_ready = success;
  return {
    total: rows.length,
    failed,
    success,
    queued,
    label_ready,
  };
}

/**
 * batch_job_id 기준 calls 행 전부 + 집계 (파일 검수 Step3/4와 /calls 동일 소스).
 */
export async function getBatchStatsFromDB(batchJobId: string): Promise<{
  rows: CallRow[];
  stats: BatchCallStats;
  failureTop: BatchFailureAgg[];
}> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("batch_job_id", batchJobId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CallRow[];
  const stats = computeBatchCallStats(rows);
  const failRows = rows.filter((r) => r.analysis_status === "failed");
  const agg = new Map<
    string,
    { count: number; analysis_error_code: string | null; analysis_error_message: string | null }
  >();
  for (const r of failRows) {
    const k = `${r.analysis_error_code ?? ""}\t${r.analysis_error_message ?? ""}`;
    const cur = agg.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      agg.set(k, {
        count: 1,
        analysis_error_code: r.analysis_error_code ?? null,
        analysis_error_message: r.analysis_error_message ?? null,
      });
    }
  }
  const failureTop = [...agg.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { rows, stats, failureTop };
}

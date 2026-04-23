import type { CallsDashboardSummary } from "@/lib/db/callDashboard";

export function CallDashboardSummary(props: { summary: CallsDashboardSummary }) {
  const { summary } = props;
  const entries = Object.entries(summary.intentCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mb-6 rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        요약 (현재 필터 기준)
      </h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-zinc-500">총 통화</dt>
          <dd className="text-lg font-semibold">{summary.total}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">room_no 추출률</dt>
          <dd className="text-lg font-semibold">
            {summary.roomNoRatePercent == null
              ? "—"
              : `${summary.roomNoRatePercent}% (분석 완료 건 기준)`}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">워크플로 생성률</dt>
          <dd className="text-lg font-semibold">
            {summary.workflowCreatedRatePercent == null
              ? "—"
              : `${summary.workflowCreatedRatePercent}%`}
          </dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-zinc-500">primary_intent 분포</dt>
          <dd className="mt-1 font-mono text-xs">
            {entries.length === 0 ? (
              <span className="text-zinc-400">—</span>
            ) : (
              entries.map(([k, v]) => (
                <span key={k} className="mr-4 inline-block">
                  {k}: {v}
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

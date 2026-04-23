"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  review_priority_score: number;
  cluster_key: string | null;
  predicted_call_type: string | null;
  intent_score: number | null;
  is_fallback: boolean;
  review_status: string;
  call: {
    id: string;
    created_at: string;
    phone_number: string | null;
    analysis_status: string | null;
    primary_intent: string | null;
    analysis_confidence: number | null;
  };
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "warning_only", label: "warning만" },
  { value: "partial_only", label: "partial만" },
  { value: "other_only", label: "기타만" },
  { value: "fallback_only", label: "fallback만" },
  { value: "pending_only", label: "미검수만" },
];

function ReviewCandidatesInner() {
  const sp = useSearchParams();
  const job = sp.get("job") ?? "";
  const clusterKey = sp.get("cluster") ?? "";
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!job) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    const res = await fetch(`/api/review/jobs/${job}/candidates${q}`);
    const data = (await res.json()) as { candidates?: Row[] };
    setRows(data.candidates ?? []);
    setLoading(false);
  }, [job, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-zinc-500">
          <code>?job=</code> 쿼리가 필요합니다.{" "}
          <Link href="/review" className="text-blue-600 underline">
            대시보드
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">검수 후보 목록</h1>
        <Link
          href="/review"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 대시보드
        </Link>
      </div>

      {clusterKey ? (
        <p className="mt-2 rounded border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          cluster 필터:{" "}
          <code className="rounded bg-zinc-900 px-1 text-xs">{clusterKey}</code>{" "}
          <Link
            href={`/review/candidates?job=${encodeURIComponent(job)}`}
            className="ml-2 text-amber-200 underline"
          >
            필터 해제
          </Link>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-zinc-500">필터</label>
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTERS.map((f) => (
            <option key={f.value || "all"} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="p-2">통화일시</th>
              <th className="p-2">전화</th>
              <th className="p-2">분석</th>
              <th className="p-2">call_type 예측</th>
              <th className="p-2">intent_score</th>
              <th className="p-2">fallback</th>
              <th className="p-2">priority</th>
              <th className="p-2">cluster</th>
              <th className="p-2">검수</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-4 text-zinc-500">
                  로딩…
                </td>
              </tr>
            ) : (() => {
              const displayRows = clusterKey
                ? rows.filter((r) => r.cluster_key === clusterKey)
                : rows;
              if (displayRows.length === 0) {
                return (
                  <tr>
                    <td colSpan={10} className="p-4 text-zinc-500">
                      {clusterKey
                        ? "이 cluster에 해당하는 후보 없음"
                        : "후보 없음"}
                    </td>
                  </tr>
                );
              }
              return displayRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="p-2 whitespace-nowrap">
                    {new Date(r.call.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-2">{r.call.phone_number ?? "—"}</td>
                  <td className="p-2">{r.call.analysis_status ?? "—"}</td>
                  <td className="p-2">{r.predicted_call_type ?? "—"}</td>
                  <td className="p-2 tabular-nums">
                    {r.intent_score != null
                      ? Number(r.intent_score).toFixed(2)
                      : "—"}
                  </td>
                  <td className="p-2">{r.is_fallback ? "yes" : "—"}</td>
                  <td className="p-2 tabular-nums">{r.review_priority_score}</td>
                  <td className="max-w-[10rem] truncate p-2 font-mono text-[10px]" title={r.cluster_key ?? ""}>
                    {r.cluster_key?.slice(0, 24) ?? "—"}
                  </td>
                  <td className="p-2">{r.review_status}</td>
                  <td className="p-2">
                    <Link
                      href={`/review/label/${r.id}?job=${job}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      라벨링
                    </Link>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReviewCandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-500">
          로딩…
        </div>
      }
    >
      <ReviewCandidatesInner />
    </Suspense>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type BatchRow = {
  id: string;
  name: string | null;
  pipeline: string;
  status: string;
  total_count: number;
};

function CallDataFiltersInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [batchJobs, setBatchJobs] = useState<BatchRow[]>([]);
  const [lastReviewBatchId, setLastReviewBatchId] = useState<string | null>(
    null,
  );

  const dateFrom = sp.get("dateFrom") ?? "";
  const dateTo = sp.get("dateTo") ?? "";
  const analysisStatus = sp.get("analysis_status") ?? "";
  const callType = sp.get("call_type") ?? "";
  const batchId = sp.get("batch_id") ?? "";
  const review = sp.get("review") ?? "any";

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/review/batch-jobs");
      const data = (await res.json()) as { batch_jobs?: BatchRow[] };
      setBatchJobs(data.batch_jobs ?? []);
    })();
  }, []);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem("review_last_batch_job_id");
      setLastReviewBatchId(v && v.length > 0 ? v : null);
    } catch {
      setLastReviewBatchId(null);
    }
  }, []);

  const apply = useCallback(() => {
    const q = new URLSearchParams();
    const df = (document.getElementById("cdf-dateFrom") as HTMLInputElement | null)?.value ?? "";
    const dt = (document.getElementById("cdf-dateTo") as HTMLInputElement | null)?.value ?? "";
    const ast = (document.getElementById("cdf-analysis") as HTMLSelectElement | null)?.value ?? "";
    const ct = (document.getElementById("cdf-callType") as HTMLInputElement | null)?.value ?? "";
    const bid = (document.getElementById("cdf-batch") as HTMLSelectElement | null)?.value ?? "";
    const rev = (document.getElementById("cdf-review") as HTMLSelectElement | null)?.value ?? "any";
    if (df) q.set("dateFrom", df);
    if (dt) q.set("dateTo", dt);
    if (ast) q.set("analysis_status", ast);
    if (ct.trim()) q.set("call_type", ct.trim());
    if (bid) q.set("batch_id", bid);
    if (rev && rev !== "any") q.set("review", rev);
    q.set("page", "1");
    router.push(`/calls?${q.toString()}`);
  }, [router]);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">시작일</span>
          <input
            id="cdf-dateFrom"
            type="date"
            defaultValue={dateFrom}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">종료일</span>
          <input
            id="cdf-dateTo"
            type="date"
            defaultValue={dateTo}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">analysis_status</span>
          <select
            id="cdf-analysis"
            defaultValue={analysisStatus}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">전체</option>
            <option value="queued">queued</option>
            <option value="pending">pending (레거시)</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="partial">partial</option>
            <option value="warning">warning</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">call_type (primary_intent)</span>
          <input
            id="cdf-callType"
            type="text"
            defaultValue={callType}
            placeholder="예: other, reservation_inquiry"
            className="w-48 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">batch_id</span>
          <select
            id="cdf-batch"
            defaultValue={batchId}
            className="max-w-xs rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">전체</option>
            {batchJobs.map((b) => (
              <option key={b.id} value={b.id}>
                {(b.name ?? b.pipeline) +
                  ` · ${b.status} · ${b.total_count}건 · ${b.id.slice(0, 8)}…`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-500">검수</span>
          <select
            id="cdf-review"
            defaultValue={review}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="any">전체</option>
            <option value="labeled">라벨 있음</option>
            <option value="unlabeled">라벨 없음</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => apply()}
          className="rounded bg-zinc-900 px-3 py-1.5 text-white text-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          적용
        </button>
        {lastReviewBatchId && lastReviewBatchId !== batchId ? (
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams();
              q.set("batch_id", lastReviewBatchId);
              q.set("page", "1");
              router.push(`/calls?${q.toString()}`);
            }}
            className="rounded border border-teal-700 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50 dark:border-teal-600 dark:text-teal-200 dark:hover:bg-teal-950/50"
          >
            파일 검수 마지막 배치만 보기
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CallDataFilters() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">필터 로딩…</div>}>
      <CallDataFiltersInner />
    </Suspense>
  );
}

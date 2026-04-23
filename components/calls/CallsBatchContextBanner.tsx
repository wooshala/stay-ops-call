"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** /calls?batch_id=… 로 들어온 경우 안내 배너 */
export function CallsBatchContextBanner(props: { batchId: string }) {
  const { batchId } = props;
  const sp = useSearchParams();
  const q = new URLSearchParams(sp.toString());
  q.delete("batch_id");
  q.set("page", "1");
  const clearHref = `/calls${q.toString() ? `?${q.toString()}` : ""}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-800/60 bg-teal-950/40 px-4 py-3 text-sm text-teal-100">
      <span>
        이번 배치만 보는 중 ·{" "}
        <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
          {batchId.slice(0, 8)}…
        </code>
      </span>
      <Link
        href={clearHref}
        className="shrink-0 rounded border border-teal-700 px-3 py-1 text-xs text-teal-200 hover:bg-teal-900/50"
      >
        전체 통화 보기
      </Link>
    </div>
  );
}

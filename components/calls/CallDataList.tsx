"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CallDataRow } from "@/lib/db/callDataViewer";

/** Server Component 등에서 넘길 수 있는 직렬화 가능한 props만 사용 */
export type CallDataListProps = {
  rows: CallDataRow[];
  total: number;
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // Fixed UTC format to avoid server/client locale hydration mismatch.
    return d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return iso;
  }
}

function analysisClass(s: string | null | undefined): string {
  switch (s) {
    case "completed":
      return "text-emerald-600 dark:text-emerald-400";
    case "partial":
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "skipped":
      return "text-slate-500";
    case "failed":
      return "text-red-500";
    default:
      return "";
  }
}

export function CallDataList(props: CallDataListProps) {
  const { rows, total } = props;
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        표시 {rows.length}건 / 일치 {total}건 (최대 4000건까지 조회 후 필터)
      </p>
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-3">일시</th>
            <th className="py-2 pr-3">전화(e164)</th>
            <th className="py-2 pr-3">길이</th>
            <th className="py-2 pr-3">분석</th>
            <th className="py-2 pr-3">call_type</th>
            <th className="py-2 pr-3">intent</th>
            <th className="py-2 pr-3">fb</th>
            <th className="py-2 pr-3">검수</th>
            <th className="py-2 pr-3">batch</th>
            <th className="py-2 pr-3">실패 사유</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
            >
              <td className="py-2 pr-3 whitespace-nowrap">
                <Link
                  href={`/calls/${r.id}`}
                  className="block text-blue-600 hover:underline dark:text-blue-400"
                >
                  {fmtTime(r.created_at)}
                </Link>
              </td>
              <td className="py-2 pr-3 font-mono">
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.phone_e164 ?? "—"}
                </Link>
              </td>
              <td className="py-2 pr-3 tabular-nums">
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.duration_sec != null ? `${r.duration_sec}s` : "—"}
                </Link>
              </td>
              <td
                className={`py-2 pr-3 ${analysisClass(r.analysis_status)}`}
              >
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.analysis_status ?? "—"}
                </Link>
              </td>
              <td className="py-2 pr-3 max-w-[8rem] truncate" title={r.call_type ?? ""}>
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.call_type ?? "—"}
                </Link>
              </td>
              <td className="py-2 pr-3 tabular-nums">
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.intent_score != null
                    ? Number(r.intent_score).toFixed(2)
                    : "—"}
                </Link>
              </td>
              <td className="py-2 pr-3">
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.is_fallback ? "Y" : "—"}
                </Link>
              </td>
              <td className="py-2 pr-3">
                <Link href={`/calls/${r.id}`} className="block text-inherit">
                  {r.review === "labeled"
                    ? "완료"
                    : r.review === "candidate"
                      ? "후보"
                      : "—"}
                </Link>
              </td>
              <td className="max-w-[6rem] truncate py-2 pr-3 font-mono text-[10px]" title={r.batch_job_id ?? ""}>
                {r.batch_job_id ? (
                  <button
                    type="button"
                    className="w-full text-left text-blue-600 underline dark:text-blue-400"
                    onClick={() =>
                      router.push(
                        `/calls?batch_id=${encodeURIComponent(r.batch_job_id!)}&page=1`,
                      )
                    }
                  >
                    …{r.batch_job_id.slice(0, 8)}
                  </button>
                ) : (
                  <Link href={`/calls/${r.id}`} className="block text-inherit">
                    —
                  </Link>
                )}
              </td>
              <td className="max-w-[14rem] py-2 pr-3 align-top text-[11px] text-red-700 dark:text-red-400">
                {r.analysis_status === "failed" ? (
                  <span className="line-clamp-2" title={r.analysis_error_message ?? ""}>
                    {r.analysis_error_code ? (
                      <span className="font-mono">{r.analysis_error_code}</span>
                    ) : null}
                    {r.analysis_error_code && r.analysis_error_message ? " · " : null}
                    {r.analysis_error_message ?? "—"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">조건에 맞는 통화가 없습니다.</p>
      ) : null}
    </div>
  );
}

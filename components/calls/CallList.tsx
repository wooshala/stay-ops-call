import Link from "next/link";

import type { CallListRow } from "@/lib/db/callDashboard";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function fmtShortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function analysisStatusClass(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "text-emerald-700 dark:text-emerald-400";
    case "partial":
    case "warning":
      return "text-amber-700 dark:text-amber-400";
    case "skipped":
      return "text-slate-600 dark:text-slate-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "processing":
      return "text-blue-700 dark:text-blue-400";
    default:
      return "";
  }
}

function persistLevelClass(level: string | null | undefined): string {
  switch (level) {
    case "full":
      return "text-emerald-700 dark:text-emerald-400";
    case "partial_db":
      return "text-amber-700 dark:text-amber-400";
    case "minimal":
      return "text-orange-700 dark:text-orange-400";
    case "none":
      return "text-red-600 dark:text-red-400";
    default:
      return "";
  }
}

export function CallList(props: { rows: CallListRow[]; total: number }) {
  const { rows, total } = props;
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        표시 {rows.length}건 / 필터 일치 {total}건
      </p>
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-3">call_id</th>
            <th className="py-2 pr-3">created_at</th>
            <th className="py-2 pr-3">primary_intent</th>
            <th className="py-2 pr-3">room_no</th>
            <th className="py-2 pr-3">workflow_type</th>
            <th className="py-2 pr-3">severity</th>
            <th className="py-2 pr-3">error_stage</th>
            <th className="py-2 pr-3">stt_status</th>
            <th className="py-2 pr-3">analysis_status</th>
            <th className="py-2 pr-3">persist</th>
            <th className="py-2 pr-3"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 pr-3 align-top font-mono" title={r.id}>
                {fmtShortId(r.id)}
              </td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {fmtTime(r.created_at)}
              </td>
              <td className="py-2 pr-3 align-top">{r.primary_intent ?? "—"}</td>
              <td className="py-2 pr-3 align-top max-w-[8rem] truncate" title={r.room_no ?? ""}>
                {r.room_no ?? "—"}
              </td>
              <td className="py-2 pr-3 align-top">{r.workflow_type}</td>
              <td className="py-2 pr-3 align-top">{r.severity ?? "—"}</td>
              <td className="py-2 pr-3 align-top">{r.error_stage ?? "—"}</td>
              <td className="py-2 pr-3 align-top">{r.stt_status ?? "—"}</td>
              <td
                className={`py-2 pr-3 align-top ${analysisStatusClass(r.analysis_status)}`}
              >
                {r.analysis_status ?? "—"}
              </td>
              <td
                className={`py-2 pr-3 align-top font-mono text-[11px] ${persistLevelClass(r.analysis_persist_level)}`}
              >
                {r.analysis_persist_level ?? "—"}
              </td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                <Link
                  href={`/calls/${r.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  상세
                </Link>
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

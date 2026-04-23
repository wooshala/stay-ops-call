"use client";

import Link from "next/link";

import {
  confidenceTextClass,
  formatConfidence,
  getStatusBadgeVariant,
} from "@/lib/ops/queueHelpers";
import type { OpsQueueItem } from "@/lib/types/opsQueue";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}…` : id;
}

function errorCell(row: OpsQueueItem): string {
  if (row.workflow_error_message?.trim()) return row.workflow_error_message.trim();
  if (row.workflow_error_code?.trim()) return row.workflow_error_code.trim();
  return "—";
}

export type OpsQueueTableProps = {
  items: OpsQueueItem[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  rowPending: Record<string, "analyze" | "workflow" | null>;
  onAnalyze: (id: string) => void;
  onWorkflow: (id: string) => void;
};

export function OpsQueueTable(props: OpsQueueTableProps) {
  const { items, loading, error, emptyMessage, rowPending, onAnalyze, onWorkflow } =
    props;

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-3">Call ID</th>
            <th className="py-2 pr-3">File Name</th>
            <th className="py-2 pr-3">Intent</th>
            <th className="py-2 pr-3">Summary</th>
            <th className="py-2 pr-3">Confidence</th>
            <th className="py-2 pr-3">Analysis</th>
            <th className="py-2 pr-3">Workflow</th>
            <th className="py-2 pr-3">Error</th>
            <th className="py-2 pr-3">Updated</th>
            <th className="py-2 pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const aBadge = getStatusBadgeVariant(row.analysis_status);
            const wBadge = getStatusBadgeVariant(row.workflow_status);
            const pending = rowPending[row.id];
            return (
              <tr
                key={row.id}
                className="border-b border-zinc-100 dark:border-zinc-900"
              >
                <td className="py-2 pr-3 font-mono">
                  <Link
                    href={`/calls/${row.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                    title={row.id}
                  >
                    {shortId(row.id)}
                  </Link>
                </td>
                <td className="max-w-[10rem] truncate py-2 pr-3" title={row.source_file_name ?? ""}>
                  {row.source_file_name?.trim() ? row.source_file_name : "—"}
                </td>
                <td className="max-w-[8rem] truncate py-2 pr-3" title={row.primary_intent ?? ""}>
                  {row.primary_intent ?? "—"}
                </td>
                <td
                  className="max-w-[14rem] py-2 pr-3 align-top"
                  title={row.summary ?? ""}
                >
                  <div className="line-clamp-2 whitespace-normal">
                    {row.summary?.trim() ? row.summary : "—"}
                  </div>
                </td>
                <td className={`py-2 pr-3 tabular-nums ${confidenceTextClass(row.analysis_confidence)}`}>
                  {formatConfidence(row.analysis_confidence)}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${aBadge.className}`}
                  >
                    {aBadge.label}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${wBadge.className}`}
                  >
                    {wBadge.label}
                  </span>
                </td>
                <td className="max-w-[12rem] truncate py-2 pr-3" title={errorCell(row)}>
                  {errorCell(row)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{fmtTime(row.updated_at)}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => onAnalyze(row.id)}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {pending === "analyze" ? "…" : "Re-run Analysis"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => onWorkflow(row.id)}
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {pending === "workflow" ? "…" : "Re-run Workflow"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

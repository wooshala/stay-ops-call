import type { OpsQueueType } from "@/lib/types/opsQueue";

export function getQueueTypeMeta(type: OpsQueueType): {
  label: string;
  description: string;
  emptyMessage: string;
} {
  if (type === "failed") {
    return {
      label: "Failed",
      description: "workflow 실패 건",
      emptyMessage: "Failed queue is empty",
    };
  }
  if (type === "review") {
    return {
      label: "Needs Review",
      description: "사람이 확인해야 하는 저신뢰도 건",
      emptyMessage: "No calls need review",
    };
  }
  return {
    label: "Retry Queue",
    description: "analysis 재처리 대기 건",
    emptyMessage: "Retry queue is empty",
  };
}

export function formatConfidence(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return String(value);
}

export function confidenceTextClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "text-zinc-500";
  if (value >= 0.7) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 0.3) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function getStatusBadgeVariant(
  status: string | null | undefined,
): { className: string; label: string } {
  const s = (status ?? "").trim() || "—";
  switch (s) {
    case "completed":
      return {
        label: s,
        className:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      };
    case "failed":
      return {
        label: s,
        className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
      };
    case "queued":
      return {
        label: s,
        className:
          "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100",
      };
    case "processing":
      return {
        label: s,
        className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
      };
    case "skipped":
    case "not_started":
      return {
        label: s,
        className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      };
    default:
      return {
        label: s,
        className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
      };
  }
}

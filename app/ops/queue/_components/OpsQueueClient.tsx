"use client";

import { useCallback, useEffect, useState } from "react";

import { triggerCallAnalyze, triggerCallWorkflow } from "@/app/calls/actions";
import { getQueueTypeMeta } from "@/lib/ops/queueHelpers";
import type { OpsQueueItem, OpsQueueType } from "@/lib/types/opsQueue";

import { loadOpsQueue } from "../actions";
import { OpsQueueTable } from "./OpsQueueTable";

const TABS: OpsQueueType[] = ["failed", "review", "retry"];

export function OpsQueueClient() {
  const [active, setActive] = useState<OpsQueueType>("failed");
  const [items, setItems] = useState<OpsQueueItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [rowPending, setRowPending] = useState<
    Record<string, "analyze" | "workflow" | null>
  >({});

  const load = useCallback(async (type: OpsQueueType) => {
    setLoading(true);
    setLoadError(null);
    try {
      const body = await loadOpsQueue(type, 50);
      setItems(body.items ?? []);
      setCount(typeof body.count === "number" ? body.count : (body.items?.length ?? 0));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
      setItems([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(active);
  }, [active, load]);

  const runAnalyze = async (id: string) => {
    console.log("[ops-queue][analyze]", id);
    setBanner(null);
    setRowPending((p) => ({ ...p, [id]: "analyze" }));
    try {
      await triggerCallAnalyze(id);
      setBanner({ kind: "success", text: "처리 완료되었습니다" });
      await load(active);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analyze failed";
      setBanner({ kind: "error", text: msg });
    } finally {
      setRowPending((p) => ({ ...p, [id]: null }));
    }
  };

  const runWorkflow = async (id: string) => {
    console.log("[ops-queue][workflow]", id);
    setBanner(null);
    setRowPending((p) => ({ ...p, [id]: "workflow" }));
    try {
      await triggerCallWorkflow(id);
      setBanner({ kind: "success", text: "처리 완료되었습니다" });
      await load(active);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Workflow failed";
      setBanner({ kind: "error", text: msg });
    } finally {
      setRowPending((p) => ({ ...p, [id]: null }));
    }
  };

  const meta = getQueueTypeMeta(active);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8" data-testid="ops-queue-panel">
      <h1 className="text-2xl font-semibold tracking-tight">Operations Queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        실패·검토·재처리 대상 통화를 한 화면에서 보고 분석 또는 워크플로를 다시 실행합니다.
      </p>

      {banner ? (
        <div
          className={`mt-4 rounded border px-3 py-2 text-sm ${
            banner.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => {
          const m = getQueueTypeMeta(t);
          const isOn = active === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActive(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                isOn
                  ? "border-zinc-900 text-zinc-950 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{meta.label}:</span>{" "}
        {meta.description}
        {!loading && !loadError ? (
          <span className="ml-2 tabular-nums text-zinc-500">({count}건)</span>
        ) : null}
      </p>

      <div className="mt-4">
        <OpsQueueTable
          items={items}
          loading={loading}
          error={loadError}
          emptyMessage={meta.emptyMessage}
          rowPending={rowPending}
          onAnalyze={runAnalyze}
          onWorkflow={runWorkflow}
        />
      </div>
    </div>
  );
}

"use client";

import { triggerCallAnalyze } from "@/app/calls/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CallDetailActions(props: { callId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"stt" | "analyze" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mockIdx, setMockIdx] = useState<string>("");

  async function runStt() {
    setBusy("stt");
    setMsg(null);
    try {
      const body =
        mockIdx === ""
          ? undefined
          : JSON.stringify({ mockSampleIndex: Number(mockIdx) });
      const res = await fetch(`/api/calls/${props.callId}/process-stt`, {
        method: "POST",
        headers:
          body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(json?.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "STT 실패");
    } finally {
      setBusy(null);
    }
  }

  async function runAnalyze() {
    setBusy("analyze");
    setMsg(null);
    try {
      await triggerCallAnalyze(props.callId);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mock STT 샘플 인덱스 (0–4, 비우면 자동)</span>
          <input
            value={mockIdx}
            onChange={(e) => setMockIdx(e.target.value)}
            placeholder="예: 2"
            className="w-32 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          type="button"
          disabled={busy !== null}
          onClick={runStt}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy === "stt" ? "STT 처리 중…" : "STT 처리"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={runAnalyze}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          {busy === "analyze" ? "분석 중…" : "분석 실행"}
        </button>
      </div>
      {msg ? (
        <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>
      ) : null}
    </div>
  );
}

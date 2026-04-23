"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MOCK_STT_SAMPLES } from "@/lib/stt/samples";

export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const file = fd.get("file");
    if (file instanceof File && file.size === 0) {
      fd.delete("file");
    }

    try {
      const res = await fetch("/api/calls/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? res.statusText);
        return;
      }
      const id = json?.call?.id as string | undefined;
      if (id) {
        router.push(`/calls/${id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">녹음 파일 (m4a 등, 없으면 STT mock만으로 테스트)</span>
        <input
          name="file"
          type="file"
          accept="audio/*,.m4a,.mp3,.wav"
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">시작 시각 (ISO)</span>
          <input
            name="started_at"
            type="datetime-local"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">종료 시각 (ISO)</span>
          <input
            name="ended_at"
            type="datetime-local"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">통화 길이 (초)</span>
        <input
          name="duration_sec"
          type="number"
          min={0}
          placeholder="120"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">전화번호</span>
        <input
          name="phone_number"
          placeholder="010-1234-5678"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">방향 *</span>
          <select
            name="direction"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            defaultValue="inbound"
          >
            <option value="inbound">inbound</option>
            <option value="outbound">outbound</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">출처 *</span>
          <select
            name="source_type"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            defaultValue="external"
          >
            <option value="internal">internal</option>
            <option value="external">external</option>
            <option value="smartcall">smartcall</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">객실 힌트</span>
        <input
          name="room_no_hint"
          placeholder="605"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">메모</span>
        <textarea
          name="note"
          rows={2}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mock STT 샘플 인덱스 (0–4, 비우면 자동)</span>
        <input
          name="mock_stt_sample_index"
          type="number"
          min={0}
          max={4}
          placeholder="예: 2"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <details className="rounded border border-dashed border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
        <summary className="cursor-pointer font-medium">Mock STT 샘플 문구 (참고)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          {MOCK_STT_SAMPLES.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </details>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "업로드 중…" : "저장 및 상세로 이동"}
      </button>
    </form>
  );
}

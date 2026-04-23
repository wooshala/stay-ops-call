"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CallRow } from "@/lib/types/database";
import type { ReviewJobRow, ReviewCandidateRow, ReviewLabelRow } from "@/lib/types/database";

type ReviewLink = {
  job: ReviewJobRow;
  candidate: ReviewCandidateRow;
  label: ReviewLabelRow | null;
};

const KO_TYPES = [
  "예약문의",
  "가격문의",
  "대실문의",
  "길안내",
  "취소환불",
  "불만",
  "기타",
] as const;

function getAnalysisStatusBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  const s = (status ?? "").trim();
  if (s === "queued") {
    return {
      label: "🟡 queued",
      className:
        "bg-yellow-500/15 text-yellow-200 ring-1 ring-yellow-500/30",
    };
  }
  if (s === "processing") {
    return {
      label: "🔵 processing",
      className: "bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30",
    };
  }
  if (s === "completed") {
    return {
      label: "🟢 completed",
      className:
        "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
    };
  }
  if (s === "failed") {
    return {
      label: "🔴 failed",
      className: "bg-red-500/15 text-red-200 ring-1 ring-red-500/30",
    };
  }
  if (s === "warning" || s === "partial") {
    return {
      label: "🟠 warning",
      className:
        "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30",
    };
  }
  if (!s) {
    return {
      label: "—",
      className: "bg-zinc-500/10 text-zinc-300 ring-1 ring-zinc-500/20",
    };
  }
  return {
    label: s,
    className: "bg-zinc-500/10 text-zinc-200 ring-1 ring-zinc-500/20",
  };
}

export function CallDetailWorkbench(props: {
  call: CallRow;
  batchJobId: string | null;
  reviewLinks: ReviewLink[];
  reviewJobs: ReviewJobRow[];
  actionsSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const { call, batchJobId, reviewLinks, reviewJobs, actionsSlot } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [useCleaned, setUseCleaned] = useState(false);
  const [raw, setRaw] = useState(call.transcript_text ?? "");
  const [cleaned, setCleaned] = useState(call.transcript_cleaned ?? "");
  const [reviewJobId, setReviewJobId] = useState(reviewJobs[0]?.id ?? "");
  const [labelForm, setLabelForm] = useState<{
    final_call_type: string;
    final_summary: string;
    final_price_mentioned: boolean;
    final_date_mentioned: boolean;
    reviewer_note: string;
  }>({
    final_call_type: KO_TYPES[6]!,
    final_summary: call.summary ?? "",
    final_price_mentioned: false,
    final_date_mentioned: false,
    reviewer_note: "",
  });

  const audioSrc = call.recording_url ?? undefined;
  const statusBadge = getAnalysisStatusBadge(call.analysis_status);

  async function saveTranscript(regenerate: boolean) {
    setBusy("tx");
    setMsg(null);
    try {
      const res = await fetch(`/api/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_text: raw,
          transcript_cleaned: regenerate ? undefined : cleaned,
          regenerate_cleaned: regenerate,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(null);
    }
  }

  async function saveReviewLabel() {
    if (!reviewJobId) {
      setMsg("검수 작업을 선택하세요.");
      return;
    }
    setBusy("rev");
    setMsg(null);
    try {
      const res = await fetch(`/api/calls/${call.id}/review-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_job_id: reviewJobId,
          final_call_type: labelForm.final_call_type,
          final_summary: labelForm.final_summary || null,
          final_price_mentioned: labelForm.final_price_mentioned,
          final_date_mentioned: labelForm.final_date_mentioned,
          reviewer_note: labelForm.reviewer_note || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.error ?? res.statusText);
        return;
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">녹음 · 메타</h2>
        {audioSrc ? (
          <audio controls className="w-full" src={audioSrc} preload="metadata">
            <track kind="captions" />
          </audio>
        ) : (
          <p className="text-sm text-zinc-500">
            recording_url 없음 · path: {call.recording_path ?? "—"}
          </p>
        )}
        <dl className="space-y-1 text-xs text-zinc-400">
          <div>
            <dt className="text-zinc-500">call_id</dt>
            <dd className="font-mono text-[10px] break-all">{call.id}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">시작/종료</dt>
            <dd>
              {call.started_at ?? "—"} ~ {call.ended_at ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">전화</dt>
            <dd>{call.phone_number ?? "—"} / {call.normalized_phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">길이</dt>
            <dd>{call.duration_sec != null ? `${call.duration_sec}s` : "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">batch_id</dt>
            <dd className="font-mono">{batchJobId ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Transcript</h2>
        <label className="block text-xs text-zinc-500">transcript_raw</label>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <label className="block text-xs text-zinc-500">transcript_cleaned</label>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
          value={cleaned}
          onChange={(e) => setCleaned(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveTranscript(false)}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700"
          >
            저장
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveTranscript(true)}
            className="rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
          >
            원문 저장 + cleaned 재생성
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">분석 · 검수</h2>
          <div className="flex min-w-[260px] flex-col items-end gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
            {actionsSlot ? <div className="w-full">{actionsSlot}</div> : null}
          </div>
        </div>
        <div className="rounded bg-zinc-900/50 p-2 text-xs">
          <div className="font-medium text-zinc-400">AI 요약</div>
          <p className="mt-1 text-zinc-200">{call.summary ?? "—"}</p>
          <div className="mt-2 grid gap-1 text-zinc-400">
            <span>call_type: {call.primary_intent ?? "—"}</span>
            <span>
              intent_score:{" "}
              {call.analysis_confidence != null
                ? call.analysis_confidence.toFixed(3)
                : "—"}
            </span>
            <span>analysis_error_code: {call.analysis_error_code ?? "—"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useCleaned}
              onChange={(e) => setUseCleaned(e.target.checked)}
            />
            transcript_cleaned로 분석 실행(즉시 실행 버튼 사용)
          </label>
        </div>

        <div className="border-t border-zinc-800 pt-3">
          <h3 className="text-xs font-medium text-zinc-500">검수 연결</h3>
          {reviewLinks.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {reviewLinks.map((l) => (
                <li key={l.candidate.id}>
                  {l.job.title}:{" "}
                  {l.label?.final_call_type ?? l.candidate.review_status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-zinc-600">연결된 검수 없음</p>
          )}
          <label className="mt-2 block text-xs text-zinc-500">review_job</label>
          <select
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-xs"
            value={reviewJobId}
            onChange={(e) => setReviewJobId(e.target.value)}
          >
            <option value="">— 선택 —</option>
            {reviewJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} · {j.id.slice(0, 8)}…
              </option>
            ))}
          </select>
          <label className="mt-2 block text-xs text-zinc-500">final_call_type</label>
          <select
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-xs"
            value={labelForm.final_call_type}
            onChange={(e) =>
              setLabelForm((f) => ({ ...f, final_call_type: e.target.value }))
            }
          >
            {KO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="mt-2 block text-xs text-zinc-500">final_summary</label>
          <textarea
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-xs"
            rows={3}
            value={labelForm.final_summary}
            onChange={(e) =>
              setLabelForm((f) => ({ ...f, final_summary: e.target.value }))
            }
          />
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={labelForm.final_price_mentioned}
              onChange={(e) =>
                setLabelForm((f) => ({
                  ...f,
                  final_price_mentioned: e.target.checked,
                }))
              }
            />
            가격 언급
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={labelForm.final_date_mentioned}
              onChange={(e) =>
                setLabelForm((f) => ({
                  ...f,
                  final_date_mentioned: e.target.checked,
                }))
              }
            />
            일정 언급
          </label>
          <label className="mt-2 block text-xs text-zinc-500">reviewer_note</label>
          <textarea
            className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-xs"
            rows={2}
            value={labelForm.reviewer_note}
            onChange={(e) =>
              setLabelForm((f) => ({ ...f, reviewer_note: e.target.value }))
            }
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveReviewLabel()}
            className="mt-2 rounded bg-violet-900 px-2 py-1 text-xs text-white hover:bg-violet-800"
          >
            {busy === "rev" ? "저장…" : "검수 라벨 저장"}
          </button>
        </div>

        {msg ? (
          <p className="text-xs text-amber-400">{msg}</p>
        ) : null}
      </div>
    </div>
  );
}

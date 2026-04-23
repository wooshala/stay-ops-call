"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

/** UI·저장용 intent 유형 (1~9 단축키) */
const INTENT_OPTIONS = [
  { key: "1", value: "reservation_inquiry", label: "예약문의" },
  { key: "2", value: "checkin_checkout",    label: "체크인/아웃" },
  { key: "3", value: "payment",             label: "결제" },
  { key: "4", value: "service_request",     label: "비품요청" },
  { key: "5", value: "maintenance",         label: "시설수리" },
  { key: "6", value: "complaint",           label: "불만" },
  { key: "7", value: "cancel_request",      label: "취소" },
  { key: "8", value: "parking",             label: "주차" },
  { key: "9", value: "other",               label: "기타" },
] as const;

type IntentValue = typeof INTENT_OPTIONS[number]["value"];

function mapIntentToValue(intent: string | null | undefined): IntentValue {
  const valid = INTENT_OPTIONS.map((o) => o.value) as readonly string[];
  if (intent && valid.includes(intent)) return intent as IntentValue;
  // legacy mapping
  const legacy: Record<string, IntentValue> = {
    rate_inquiry: "reservation_inquiry",
    extension_request: "checkin_checkout",
    quotation_intent: "reservation_inquiry",
    manual_review_required: "other",
    refund_request: "cancel_request",
  };
  return (intent && legacy[intent]) ? legacy[intent]! : "other";
}

type Detail = {
  candidate: {
    id: string;
    review_job_id: string | null;
    predicted_call_type: string | null;
    intent_score: number | null;
    is_fallback: boolean;
    cluster_key: string | null;
    review_status: string;
    is_representative: boolean;
    // snapshot (feedback loop)
    original_intent: string | null;
    original_summary: string | null;
    original_confidence: number | null;
    prompt_version: string | null;
    heuristic_version: string | null;
    source: string | null;
  };
  call: {
    id: string;
    transcript_text: string | null;
    summary: string | null;
    primary_intent: string | null;
    recording_url: string | null;
    analysis_confidence: number | null;
  };
  transcript_cleaned: string;
  label: {
    final_call_type: string | null;
    final_summary: string | null;
    final_price_mentioned: boolean | null;
    final_date_mentioned: boolean | null;
    final_requires_followup: boolean | null;
    final_should_create_record: boolean | null;
    reviewer_note: string | null;
  } | null;
};

function ReviewLabelDetailInner() {
  const router = useRouter();
  const routeParams = useParams();
  const sp = useSearchParams();
  const job = sp.get("job") ?? "";
  const candidateId = (routeParams.candidateId as string) ?? "";

  const [detail, setDetail] = useState<Detail | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [form, setForm] = useState({
    final_call_type: "" as IntentValue | "",
    final_summary: "",
    final_price_mentioned: false,
    final_date_mentioned: false,
    final_requires_followup: false,
    final_should_create_record: false,
    reviewer_note: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/review/candidates/${id}`);
    if (!res.ok) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as Detail;
    setDetail(data);
    const l = data.label;
    setForm({
      final_call_type:
        (l?.final_call_type as IntentValue | null) ??
        mapIntentToValue(
          data.candidate.original_intent ??
          data.candidate.predicted_call_type ??
          data.call.primary_intent,
        ),
      final_summary: l?.final_summary ?? data.candidate.original_summary ?? data.call.summary ?? "",
      final_price_mentioned: l?.final_price_mentioned ?? false,
      final_date_mentioned: l?.final_date_mentioned ?? false,
      final_requires_followup: l?.final_requires_followup ?? false,
      final_should_create_record: l?.final_should_create_record ?? false,
      reviewer_note: l?.reviewer_note ?? "",
    });
    setLoading(false);
  }, []);

  const loadQueue = useCallback(async () => {
    if (!job) return;
    const res = await fetch(
      `/api/review/jobs/${job}/candidates?filter=pending_only`,
    );
    const data = (await res.json()) as {
      candidates?: Array<{ id: string }>;
    };
    const ids = (data.candidates ?? []).map((c) => c.id);
    setQueue(ids);
  }, [job]);

  useEffect(() => {
    if (!candidateId) return;
    void loadDetail(candidateId);
    void loadQueue();
  }, [candidateId, loadDetail, loadQueue]);

  const goNext = useCallback(() => {
    const idx = queue.indexOf(candidateId);
    const next =
      idx >= 0 && idx < queue.length - 1 ? queue[idx + 1]! : null;
    if (next) {
      router.push(`/review/label/${next}?job=${job}`);
    } else {
      router.push(`/review/candidates?job=${job}`);
    }
  }, [queue, candidateId, job, router]);

  const goPrev = useCallback(() => {
    const idx = queue.indexOf(candidateId);
    const prev = idx > 0 ? queue[idx - 1] : null;
    if (prev) {
      router.push(`/review/label/${prev}?job=${job}`);
    }
  }, [queue, candidateId, job, router]);

  const refreshPendingIds = useCallback(async () => {
    if (!job) return [];
    const res = await fetch(
      `/api/review/jobs/${job}/candidates?filter=pending_only`,
    );
    const data = (await res.json()) as {
      candidates?: Array<{ id: string }>;
    };
    const ids = (data.candidates ?? []).map((c) => c.id);
    setQueue(ids);
    return ids;
  }, [job]);

  const save = async (thenNext: boolean) => {
    if (!candidateId || !job) return;
    setSaving(true);
    try {
      const f = formRef.current;
      const res = await fetch(`/api/review/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          final_call_type: f.final_call_type || null,
          final_summary: f.final_summary || null,
          final_price_mentioned: f.final_price_mentioned,
          final_date_mentioned: f.final_date_mentioned,
          final_requires_followup: f.final_requires_followup,
          final_should_create_record: f.final_should_create_record,
          reviewer_note: f.reviewer_note || null,
        }),
      });
      if (!res.ok) return;
      const ids = await refreshPendingIds();
      if (thenNext) {
        const next = ids[0] ?? null;
        if (next) {
          router.push(`/review/label/${next}?job=${job}`);
        } else {
          router.push(`/review/candidates?job=${job}`);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (!candidateId || !job) return;
    setSaving(true);
    try {
      await fetch(`/api/review/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      const ids = await refreshPendingIds();
      const next = ids[0] ?? null;
      if (next) {
        router.push(`/review/label/${next}?job=${job}`);
      } else {
        router.push(`/review/candidates?job=${job}`);
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save(true);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void save(true);
        return;
      }
      const d = e.key;
      if (d >= "1" && d <= "9") {
        const opt = INTENT_OPTIONS.find((o) => o.key === d);
        if (opt) {
          e.preventDefault();
          setForm((f) => ({ ...f, final_call_type: opt.value }));
        }
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setForm((f) => ({ ...f, final_requires_followup: !f.final_requires_followup }));
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setForm((f) => ({ ...f, final_should_create_record: !f.final_should_create_record }));
        return;
      }
      if (e.key === "ArrowRight" && !e.ctrlKey) {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        void skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, goNext, goPrev, skip]);

  if (!job) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-zinc-500">
        <code>?job=</code> 쿼리가 필요합니다.
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-zinc-500">
        로딩…
      </div>
    );
  }

  const c = detail.call;
  const audio = c.recording_url;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/review/candidates?job=${job}`}
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 후보 목록
        </Link>
        <div className="text-xs text-zinc-500">
          1~9 유형 · F 후속필요 · R 기록필요 · Enter 저장·다음 · Ctrl+Enter (텍스트) · ← → · S 건너뛰기
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400">오디오 · 원문</h2>
          {audio ? (
            <audio controls className="w-full" src={audio}>
              <track kind="captions" />
            </audio>
          ) : (
            <p className="text-sm text-zinc-500">녹음 URL 없음</p>
          )}
          <div>
            <h3 className="text-xs font-medium text-zinc-500">transcript_raw</h3>
            <pre className="mt-1 max-h-[min(28rem,50vh)] overflow-auto whitespace-pre-wrap rounded border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200">
              {c.transcript_text ?? "—"}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400">cleaned</h2>
          <pre className="max-h-[min(32rem,55vh)] overflow-auto whitespace-pre-wrap rounded border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200">
            {detail.transcript_cleaned || "—"}
          </pre>
          {detail.candidate.is_representative ? (
            <p className="text-xs text-teal-400">★ 대표 샘플 (우선 순회)</p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400">AI 예측 (snapshot)</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">original_intent</dt>
              <dd className="font-medium text-amber-300">
                {detail.candidate.original_intent ?? c.primary_intent ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">original_summary</dt>
              <dd className="text-zinc-200 text-xs leading-relaxed">
                {detail.candidate.original_summary ?? c.summary ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">confidence</dt>
              <dd className="tabular-nums">
                {(detail.candidate.original_confidence ?? c.analysis_confidence) != null
                  ? (detail.candidate.original_confidence ?? c.analysis_confidence)!.toFixed(2)
                  : "—"}
              </dd>
            </div>
            <div className="flex gap-4 text-xs text-zinc-500">
              <span>prompt: {detail.candidate.prompt_version ?? "—"}</span>
              <span>heuristic: {detail.candidate.heuristic_version ?? "—"}</span>
            </div>
            <div>
              <dt className="text-zinc-500">source</dt>
              <dd className="text-xs">{detail.candidate.source ?? "—"}</dd>
            </div>
          </dl>

          <h2 className="pt-2 text-sm font-semibold text-zinc-400">라벨</h2>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-zinc-500">intent (1~9)</span>
              <select
                className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                value={form.final_call_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, final_call_type: e.target.value as IntentValue }))
                }
              >
                {INTENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.key}. {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">final_summary</span>
              <textarea
                className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                rows={4}
                value={form.final_summary}
                onChange={(e) =>
                  setForm((f) => ({ ...f, final_summary: e.target.value }))
                }
              />
            </label>

            <div className="rounded border border-zinc-700 bg-zinc-900 p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-400">운영 판단 (F / R)</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.final_requires_followup}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, final_requires_followup: e.target.checked }))
                  }
                />
                <span>
                  후속 연락 필요 <span className="text-zinc-500 text-xs">(F)</span>
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.final_should_create_record}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, final_should_create_record: e.target.checked }))
                  }
                />
                <span>
                  기록 생성 필요 <span className="text-zinc-500 text-xs">(R)</span>
                </span>
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-zinc-500">reviewer_note</span>
              <textarea
                className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                rows={2}
                value={form.reviewer_note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reviewer_note: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              className="rounded bg-teal-800 px-3 py-1.5 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
              onClick={() => void save(true)}
            >
              저장 후 다음
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => void save(false)}
            >
              저장만
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => goPrev()}
            >
              이전
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => goNext()}
            >
              다음
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded border border-amber-700 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950 disabled:opacity-50"
              onClick={() => void skip()}
            >
              건너뛰기
            </button>
            {detail.candidate.cluster_key ? (
              <Link
                href={`/review/candidates?job=${job}&cluster=${encodeURIComponent(detail.candidate.cluster_key)}`}
                className="rounded border border-violet-600 px-3 py-1.5 text-sm text-violet-300 hover:bg-violet-950"
              >
                같은 cluster 보기
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewLabelDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-zinc-500">
          로딩…
        </div>
      }
    >
      <ReviewLabelDetailInner />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildQuoteDraft,
  prepareQuoteDraftForSend,
  roomTypeLabel,
  selectRoomTypeForQuoteDraft,
  type MockCallInput,
  type QuoteDraft,
  type RoomType,
} from "@/services/quote-engine";

const ROOM_TYPES: RoomType[] = ["standard", "deluxe", "suite"];

type ApiCallDetailResponse = {
  call?: {
    id: string;
    phone_number?: string | null;
    source_file_name?: string | null;
    transcript_text?: string | null;
    summary?: string | null;
    primary_intent?: string | null;
    quote_draft?: string | null;
    created_at?: string | null;
  };
  entities?: Array<{
    checkin_date?: string | null;
  }>;
};

type PersistedQuoteDraftFields = Pick<
  QuoteDraft,
  | "selectedRoomType"
  | "priceSnapshot"
  | "messageDraft"
  | "status"
  | "needsReviewReason"
  | "needsReviewReasons"
  | "updatedAt"
>;

type SaveState = "idle" | "saving" | "saved" | "error";
type FinalizeState = "idle" | "submitting" | "done" | "error";

function formatStayType(value: QuoteDraft["stayType"]): string {
  return value === "dayuse" ? "대실" : "숙박";
}

function formatSchedule(draft: QuoteDraft): string {
  if (draft.requestedDate) return draft.requestedDate;
  if (draft.requestedWeekday) return `${draft.requestedWeekday} 기준`;
  return "날짜 확인 필요";
}

function storageKey(callId: string): string {
  return `quote-draft:${callId}`;
}

function pickPersistFields(draft: QuoteDraft): PersistedQuoteDraftFields {
  return {
    selectedRoomType: draft.selectedRoomType,
    priceSnapshot: draft.priceSnapshot,
    messageDraft: draft.messageDraft,
    status: draft.status,
    needsReviewReason: draft.needsReviewReason,
    needsReviewReasons: draft.needsReviewReasons,
    updatedAt: draft.updatedAt,
  };
}

function mapCallToMockCallInput(payload: ApiCallDetailResponse["call"]): MockCallInput {
  return {
    id: payload?.id ?? "unknown",
    phone_number: payload?.phone_number ?? null,
    source_file_name: payload?.source_file_name ?? null,
    transcript: payload?.transcript_text ?? null,
    summary: payload?.summary ?? "",
    inquiry_type: payload?.primary_intent ?? null,
  };
}

export function QuoteDraftDetailClient({ id }: { id: string }) {
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalizeState, setFinalizeState] = useState<FinalizeState>("idle");
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const didInitAutoSaveRef = useRef(false);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/calls/${id}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`통화 데이터를 불러오지 못했습니다. (${res.status})`);
        }

        const data = (await res.json()) as ApiCallDetailResponse;
        const call = data.call;
        if (!call?.id) {
          throw new Error("통화 데이터 형식이 올바르지 않습니다.");
        }

        const mapped = mapCallToMockCallInput(call);
        const baseDraft = buildQuoteDraft(mapped);

        const draftFromCall = (() => {
          if (!call.quote_draft) return null;
          try {
            return JSON.parse(call.quote_draft) as Partial<QuoteDraft>;
          } catch {
            return null;
          }
        })();

        const draftFromLocal = (() => {
          try {
            const raw = localStorage.getItem(storageKey(call.id));
            if (!raw) return null;
            return JSON.parse(raw) as Partial<QuoteDraft>;
          } catch {
            return null;
          }
        })();

        const mergedDraft: QuoteDraft = {
          ...baseDraft,
          ...(draftFromLocal ?? {}),
          ...(draftFromCall ?? {}),
          id: baseDraft.id,
          callId: call.id,
          updatedAt: new Date().toISOString(),
        };

        if (!cancelled) {
          setDraft(mergedDraft);
          const signature = JSON.stringify(pickPersistFields(mergedDraft));
          lastSavedSignatureRef.current = signature;
          didInitAutoSaveRef.current = false;
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "알 수 없는 오류");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const sendPrep = useMemo(
    () => (draft ? prepareQuoteDraftForSend(draft) : { canSend: false, blockedReasons: [] }),
    [draft],
  );

  const onSelectRoom = (roomType: RoomType) => {
    setDraft((prev) => (prev ? selectRoomTypeForQuoteDraft(prev, roomType) : prev));
  };

  const persistDraft = async (nextDraft: QuoteDraft) => {
    const nextUpdatedAt = new Date().toISOString();
    const persistPayload: PersistedQuoteDraftFields = {
      ...pickPersistFields(nextDraft),
      updatedAt: nextUpdatedAt,
    };
    const signature = JSON.stringify(persistPayload);
    const seq = ++requestSeqRef.current;

    setSaveState("saving");
    setSaveError(null);
    try {
      localStorage.setItem(storageKey(nextDraft.callId), JSON.stringify(persistPayload));
      if (requestSeqRef.current === seq) {
        lastSavedSignatureRef.current = signature;
        setDraft((prev) => (prev ? { ...prev, updatedAt: nextUpdatedAt } : prev));
        setSavedAt(new Date(nextUpdatedAt).toLocaleString("ko-KR"));
        setSaveState("saved");
      }
    } catch (e) {
      localStorage.setItem(storageKey(nextDraft.callId), JSON.stringify(persistPayload));
      if (requestSeqRef.current === seq) {
        setSaveError(e instanceof Error ? e.message : "저장 실패");
        setSaveState("error");
      }
    }
  };

  const onSaveDraft = () => {
    if (!draft) return Promise.resolve();
    return persistDraft(draft);
  };

  const autoSaveSignature = useMemo(() => {
    if (!draft) return null;
    return JSON.stringify(pickPersistFields(draft));
  }, [draft]);

  useEffect(() => {
    if (!draft || !autoSaveSignature || loading) return;

    if (!didInitAutoSaveRef.current) {
      didInitAutoSaveRef.current = true;
      return;
    }

    if (autoSaveSignature === lastSavedSignatureRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistDraft(draft);
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [draft, autoSaveSignature, loading]);

  const onCopyMessage = async () => {
    if (!draft || !sendPrep.canSend) return;
    await navigator.clipboard.writeText(draft.messageDraft);
  };

  const onFinalizeQuote = async () => {
    if (!draft || !sendPrep.canSend) return;
    setFinalizeState("submitting");
    setFinalizeError(null);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: draft.callId,
          draft,
          source_kind: "auto",
          source_system: "web_quote_engine",
          mark_as_sent: false,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `최종 저장 실패 (${res.status})`);
      }
      setFinalizeState("done");
    } catch (e) {
      setFinalizeState("error");
      setFinalizeError(e instanceof Error ? e.message : "최종 저장 실패");
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">견적 초안을 불러오는 중...</p>;
  }

  if (loadError) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        {loadError}
      </div>
    );
  }

  if (!draft) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">표시할 견적 초안이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="mb-1 text-zinc-500">전화번호</dt>
            <dd className="font-medium">{draft.phoneNumber ?? "없음"}</dd>
          </div>
          <div>
            <dt className="mb-1 text-zinc-500">일정</dt>
            <dd className="font-medium">{formatSchedule(draft)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-zinc-500">숙박 유형</dt>
            <dd className="font-medium">{formatStayType(draft.stayType)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-zinc-500">선택 가격</dt>
            <dd className="font-medium">
              {draft.priceSnapshot.price !== null
                ? `${draft.priceSnapshot.price.toLocaleString("ko-KR")}원`
                : "가격 확인 필요"}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1 text-zinc-500">통화 요약</dt>
            <dd>{draft.callSummary || "요약 없음"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">객실 타입 선택</h2>
        <div className="flex flex-wrap gap-2">
          {ROOM_TYPES.map((roomType) => {
            const selected = draft.selectedRoomType === roomType;
            return (
              <button
                key={roomType}
                type="button"
                onClick={() => onSelectRoom(roomType)}
                className={`rounded px-3 py-2 text-sm ${
                  selected
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {roomTypeLabel(roomType)}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">자동 생성 메시지</h2>
        <textarea
          value={draft.messageDraft}
          onChange={(e) => setDraft((prev) => (prev ? { ...prev, messageDraft: e.target.value } : prev))}
          className="min-h-52 w-full rounded border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onSaveDraft()}
            disabled={saveState === "saving"}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
          >
            {saveState === "saving" ? "저장 중..." : "초안 저장"}
          </button>
          <button
            type="button"
            onClick={() => void onCopyMessage()}
            disabled={!sendPrep.canSend}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            문자 복사
          </button>
          <button
            type="button"
            onClick={() => void onFinalizeQuote()}
            disabled={!sendPrep.canSend || finalizeState === "submitting"}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
          >
            {finalizeState === "submitting" ? "최종 저장 중..." : "문자 발송 준비"}
          </button>
          <span
            className={`text-xs ${
              saveState === "saving"
                ? "text-blue-600"
                : saveState === "saved"
                  ? "text-emerald-600"
                  : saveState === "error"
                    ? "text-amber-600"
                    : "text-zinc-500"
            }`}
          >
            {saveState === "saving"
              ? "저장 중"
              : saveState === "saved"
                ? "저장됨"
                : saveState === "error"
                  ? "저장 실패"
                  : "변경 없음"}
          </span>
          {savedAt ? <span className="text-xs text-zinc-500">최근 저장: {savedAt}</span> : null}
          {saveError ? (
            <span className="text-xs text-amber-600">저장 실패: {saveError}</span>
          ) : null}
          {finalizeState === "done" ? (
            <span className="text-xs text-emerald-600">최종 견적 저장 완료(quotes)</span>
          ) : null}
          {finalizeError ? (
            <span className="text-xs text-rose-600">최종 견적 저장 실패: {finalizeError}</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 font-semibold">발송 준비 상태</h2>
        <p className={sendPrep.canSend ? "text-emerald-600" : "text-amber-600"}>
          {sendPrep.canSend ? "발송 준비 완료" : "발송 전 확인 필요"}
        </p>
        {sendPrep.blockedReasons.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
            {sendPrep.blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="text-sm">
        <Link href={`/calls/${id}`} className="text-blue-600 underline dark:text-blue-400">
          통화 상세로 돌아가기
        </Link>
      </div>
    </div>
  );
}

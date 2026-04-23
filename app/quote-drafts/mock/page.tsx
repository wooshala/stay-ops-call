"use client";

import { useMemo, useState } from "react";

import {
  buildQuoteDraft,
  prepareQuoteDraftForSend,
  roomTypeLabel,
  selectRoomTypeForQuoteDraft,
  type MockCallInput,
  type QuoteDraft,
  type RoomType,
} from "@/services/quote-engine";

const MOCK_CALL: MockCallInput = {
  id: "call_mock_001",
  phone_number: "010-1234-5678",
  source_file_name: "call-2026-03-24-0900.wav",
  summary: "금요일 숙박 문의, 디럭스 우선 희망. 가격 확인 후 예약 의사 있음.",
  requested_weekday: "금",
  stay_type: "숙박",
  room_type_candidate: "디럭스",
  inquiry_type: "가격 문의",
};

const ROOM_TYPES: RoomType[] = ["standard", "deluxe", "suite"];
const FIXED_NOW = new Date("2026-03-24T09:00:00.000Z");

function formatStayType(value: QuoteDraft["stayType"]): string {
  return value === "dayuse" ? "대실" : "숙박";
}

function formatSchedule(draft: QuoteDraft): string {
  if (draft.requestedDate) return draft.requestedDate;
  if (draft.requestedWeekday) return `${draft.requestedWeekday} 기준`;
  return "날짜 확인 필요";
}

export default function QuoteDraftMockDetailPage() {
  const initialDraft = useMemo(() => buildQuoteDraft(MOCK_CALL, FIXED_NOW), []);
  const [draft, setDraft] = useState<QuoteDraft>(initialDraft);
  const [copied, setCopied] = useState(false);

  const sendPrep = useMemo(() => prepareQuoteDraftForSend(draft), [draft]);

  const onSelectRoom = (roomType: RoomType) => {
    setDraft((prev) => selectRoomTypeForQuoteDraft(prev, roomType, FIXED_NOW));
    setCopied(false);
  };

  const onCopyMessage = async () => {
    if (!sendPrep.canSend) return;
    try {
      await navigator.clipboard.writeText(draft.messageDraft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">견적 초안 상세 (MVP)</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          통화 종료 후 자동 생성된 견적 초안을 확인하고 객실 선택으로 가격/메시지를 즉시 갱신합니다.
        </p>
      </header>

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
          onChange={(e) => setDraft((prev) => ({ ...prev, messageDraft: e.target.value }))}
          className="min-h-52 w-full rounded border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
            disabled={!sendPrep.canSend}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
          >
            문자 발송 준비
          </button>
          {copied ? <span className="text-xs text-emerald-600">복사됨</span> : null}
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
    </main>
  );
}

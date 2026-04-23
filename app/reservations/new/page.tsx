"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  RESERVATION_RECORDER_STORAGE_KEY,
  STATUS_LABEL,
  type CallHistorySnippet,
  type PhoneHistoryResponse,
  type ReservationLog,
} from "@/lib/db/reservations";

const STATUS_OPTIONS: { value: ReservationLog["status"]; label: string }[] = [
  { value: "inquiry", label: "문의" },
  { value: "tentative", label: "구두확정" },
  { value: "confirmed", label: "확정" },
  { value: "follow_up", label: "추후연락" },
  { value: "cancelled", label: "취소" },
];

function Field({ label, required, missing, children }: {
  label: string; required?: boolean; missing?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {missing && <span className="ml-2 text-red-400 text-xs">미입력</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:border-zinc-400";

function ReservationFormInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const callId = sp.get("call_id");

  const [form, setForm] = useState({
    phone_number: sp.get("phone") ?? "",
    guest_name: "",
    check_in_date: sp.get("date") ?? "",
    check_in_time: "",
    room_type: "",
    vehicle_info: "",
    occupancy_count: "",
    status: "inquiry" as ReservationLog["status"],
    memo: "",
  });
  const [recorderName, setRecorderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [pmsPrompt, setPmsPrompt] = useState(false);
  const [history, setHistory] = useState<PhoneHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(RESERVATION_RECORDER_STORAGE_KEY)?.trim();
      if (v) setRecorderName(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (recorderName.trim()) {
        localStorage.setItem(RESERVATION_RECORDER_STORAGE_KEY, recorderName.trim());
      }
    } catch {
      /* ignore */
    }
  }, [recorderName]);

  const missing = {
    phone_number: !form.phone_number.trim(),
    check_in_date: !form.check_in_date,
  };
  const hasMissing = Object.values(missing).some(Boolean);
  const phoneEmpty = !form.phone_number.trim();

  async function lookupHistory(phone: string) {
    if (!phone.trim()) {
      setHistory(null);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/reservations/history?phone=${encodeURIComponent(phone)}`);
      const data = (await res.json()) as PhoneHistoryResponse;
      setHistory({
        reservations: data.reservations ?? [],
        calls: data.calls ?? [],
        callCount: data.callCount ?? 0,
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSave() {
    if (!form.check_in_date || !form.status) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          occupancy_count: form.occupancy_count ? Number(form.occupancy_count) : null,
          call_id: callId ?? null,
          created_by: recorderName.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장 실패");
        return;
      }
      const row = (await res.json()) as ReservationLog;
      setLastSavedId(row.id);
      setPmsPrompt(true);
    } finally {
      setSaving(false);
    }
  }

  if (pmsPrompt) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center space-y-4">
          <div className="text-2xl">✅</div>
          <p className="text-sm font-medium">예약이 기록됐습니다.</p>
          <div className="rounded border border-amber-700 bg-amber-950 p-4">
            <p className="text-sm text-amber-300 font-medium">PMS에도 입력하셨나요?</p>
            <div className="flex gap-3 mt-3 justify-center">
              <button
                onClick={async () => {
                  if (!lastSavedId) {
                    alert("예약 ID가 없습니다. 목록에서 PMS 확인을 눌러 주세요.");
                    router.push("/reservations");
                    return;
                  }
                  await fetch(`/api/reservations/${lastSavedId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      pms_confirmed: true,
                      updated_by: recorderName.trim() || null,
                    }),
                  });
                  router.push("/reservations");
                }}
                className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-600"
              >
                예, 입력했습니다
              </button>
              <button
                onClick={() => router.push("/reservations")}
                className="rounded border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-semibold">통화 후 예약 기록</h1>
          <button onClick={() => router.push("/reservations")} className="text-xs text-zinc-500 hover:text-zinc-300">
            대장 보기 →
          </button>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">

          <Field label="기록자 (직원명)">
            <input
              className={inputCls}
              placeholder="홍길동"
              value={recorderName}
              onChange={(e) => setRecorderName(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-zinc-500">브라우저에 저장되어 다음 입력 시 자동 채움됩니다. 비워 두면 감사 로그에 기록자가 남지 않습니다.</p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="전화번호" missing={missing.phone_number}>
              <input
                className={inputCls}
                placeholder="010-0000-0000"
                value={form.phone_number}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                onBlur={(e) => lookupHistory(e.target.value)}
              />
            </Field>
            <Field label="고객명">
              <input className={inputCls} placeholder="이름" value={form.guest_name}
                onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))} />
            </Field>
          </div>

          {phoneEmpty && (
            <div className="rounded border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              <strong className="font-semibold">전화번호 없이 저장됩니다.</strong>
              {" "}
              이후 통화 이력·번호 매칭이 어렵고, 대장에서도 &quot;전화없음&quot;으로 표시됩니다. 현장에서만 부득이할 때 사용하세요.
            </div>
          )}

          {/* 전화번호 이력 */}
          {historyLoading && <p className="text-xs text-zinc-500">이력 조회 중...</p>}
          {history && !historyLoading && (
            <div className="space-y-3">
              <div className="rounded border border-zinc-700 bg-zinc-950 p-3 space-y-2">
                <p className="text-xs text-zinc-400 font-medium">예약 기록 (최근)</p>
                {history.reservations.length === 0 ? (
                  <p className="text-xs text-zinc-600">예약 기록 없음</p>
                ) : (
                  history.reservations.slice(0, 5).map((h) => (
                    <div key={h.id} className="text-xs text-zinc-300 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="text-zinc-500">{h.check_in_date}</span>
                      <span>{h.guest_name ?? "—"}</span>
                      <span className={h.status === "confirmed" ? "text-teal-400" : "text-amber-400"}>
                        {STATUS_LABEL[h.status]}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="rounded border border-zinc-700 bg-zinc-950 p-3 space-y-2">
                <p className="text-xs text-zinc-400 font-medium">
                  통화 이력 (최근 {history.calls.length}건 / 전체 {history.callCount}건)
                </p>
                {history.calls.length === 0 ? (
                  <p className="text-xs text-zinc-600">이전 통화 없음</p>
                ) : (
                  history.calls.map((c: CallHistorySnippet) => (
                    <div key={c.id} className="text-xs text-zinc-300 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                      <div className="flex flex-wrap gap-x-2 text-zinc-500">
                        <span>{c.created_at?.slice(0, 19).replace("T", " ")}</span>
                        <span className="text-zinc-400">{c.primary_intent ?? "—"}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-zinc-400">
                        {c.summary?.trim() ? c.summary : "(요약 없음)"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="입실일" required missing={missing.check_in_date}>
              <input type="date" className={inputCls} value={form.check_in_date}
                onChange={(e) => setForm((f) => ({ ...f, check_in_date: e.target.value }))} />
            </Field>
            <Field label="입실시간">
              <input type="time" className={inputCls} value={form.check_in_time}
                onChange={(e) => setForm((f) => ({ ...f, check_in_time: e.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="객실/타입">
              <input className={inputCls} placeholder="ex) 스위트 101" value={form.room_type}
                onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))} />
            </Field>
            <Field label="인원">
              <input type="number" min="1" max="20" className={inputCls} placeholder="명"
                value={form.occupancy_count}
                onChange={(e) => setForm((f) => ({ ...f, occupancy_count: e.target.value }))} />
            </Field>
          </div>

          <Field label="차량 정보">
            <input className={inputCls} placeholder="차량번호 또는 차종" value={form.vehicle_info}
              onChange={(e) => setForm((f) => ({ ...f, vehicle_info: e.target.value }))} />
          </Field>

          <Field label="예약 상태" required>
            <div className="flex flex-wrap gap-2 mt-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: opt.value }))}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    form.status === opt.value
                      ? opt.value === "confirmed" ? "bg-teal-700 border-teal-600 text-white"
                        : opt.value === "cancelled" ? "bg-zinc-700 border-zinc-600 text-zinc-300"
                        : "bg-amber-800 border-amber-700 text-amber-100"
                      : "border-zinc-600 hover:bg-zinc-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="메모">
            <textarea className={inputCls} rows={2} placeholder="특이사항, 요청사항 등"
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
          </Field>

          {hasMissing && (
            <p className="text-xs text-amber-400">
              미입력 항목이 있습니다. 그래도 저장할 수 있습니다.
            </p>
          )}

          <button
            disabled={saving || !form.check_in_date || !form.status}
            onClick={handleSave}
            className="w-full rounded bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {!recorderName.trim() && (
            <p className="text-xs text-amber-500 text-center">기록자 미입력 시 created_by는 비어 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReservationNewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500 text-sm">로딩...</div>}>
      <ReservationFormInner />
    </Suspense>
  );
}

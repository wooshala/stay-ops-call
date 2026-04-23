"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RESERVATION_RECORDER_STORAGE_KEY,
  STATUS_LABEL,
  type ReservationLog,
} from "@/lib/db/reservations";

const STATUS_COLOR: Record<string, string> = {
  inquiry:   "text-zinc-300 bg-zinc-800",
  tentative: "text-amber-300 bg-amber-950",
  confirmed: "text-teal-300 bg-teal-950",
  follow_up: "text-orange-300 bg-orange-950",
  cancelled: "text-zinc-500 bg-zinc-900",
};

function rowHighlight(r: ReservationLog): string {
  if (r.status === "inquiry" || r.status === "tentative")
    return "border-l-4 border-red-500 bg-red-950/20";
  if (r.status === "follow_up")
    return "border-l-4 border-yellow-500 bg-yellow-950/20";
  if (!r.pms_confirmed && r.status !== "cancelled")
    return "border-l-4 border-orange-500 bg-orange-950/20";
  if (r.status === "confirmed" && r.pms_confirmed)
    return "border-l-4 border-teal-800 bg-teal-950/10";
  return "border-l-4 border-zinc-800 bg-zinc-900";
}

function addDays(iso: string, n: number): string {
  return new Date(new Date(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

function recorderForPatch(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RESERVATION_RECORDER_STORAGE_KEY)?.trim() || null;
}

type StatusFilter = "all" | "unconfirmed" | "pms" | "follow_up";
type DateFilter   = "today" | "7d" | "14d" | "all";

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "전체", unconfirmed: "미확정", pms: "PMS 미확인", follow_up: "추후연락",
};
const DATE_FILTER_LABEL: Record<DateFilter, string> = {
  today: "오늘", "7d": "7일", "14d": "14일", all: "전체",
};

export default function ReservationsPage() {
  const [rows, setRows]               = useState<ReservationLog[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [inputQ, setInputQ]           = useState("");
  const [q, setQ]                     = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter]   = useState<DateFilter>("today");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal]     = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);
  const [editing, setEditing]         = useState<ReservationLog | null>(null);
  const [editStatus, setEditStatus]   = useState<ReservationLog["status"]>("inquiry");
  const [editMemo, setEditMemo]       = useState("");
  const selectAllRef                  = useRef<HTMLInputElement>(null);

  // 검색 debounce
  useEffect(() => {
    const t = setTimeout(() => setQ(inputQ.trim()), 400);
    return () => clearTimeout(t);
  }, [inputQ]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const p = new URLSearchParams({ page_size: "100" });

    if (q) p.set("q", q);

    if (statusFilter === "unconfirmed") p.set("statuses", "inquiry,tentative");
    else if (statusFilter === "pms")    p.set("pms_unconfirmed", "1");
    else if (statusFilter === "follow_up") p.set("status", "follow_up");

    if (dateFilter === "today")      p.set("date", today);
    else if (dateFilter === "7d")  { p.set("date_from", today); p.set("date_to", addDays(today, 6)); }
    else if (dateFilter === "14d") { p.set("date_from", today); p.set("date_to", addDays(today, 13)); }

    const res  = await fetch(`/api/reservations?${p}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [q, statusFilter, dateFilter]);

  useEffect(() => { void load(); }, [load]);

  // select-all indeterminate 처리
  useEffect(() => {
    if (!selectAllRef.current) return;
    const some = selected.size > 0 && selected.size < rows.length;
    selectAllRef.current.indeterminate = some;
  }, [selected, rows]);

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map(r => r.id)),
    );
  }

  async function patch(id: string, body: object) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, updated_by: recorderForPatch() }),
    });
  }

  async function confirmPms(id: string) {
    await patch(id, { pms_confirmed: true });
    void load();
  }

  async function quickConfirm(id: string) {
    await patch(id, { status: "confirmed" });
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    await patch(editing.id, { status: editStatus, memo: editMemo });
    setEditing(null);
    void load();
  }

  async function bulkPmsConfirm() {
    await Promise.all([...selected].map(id => patch(id, { pms_confirmed: true })));
    setBulkModal(false);
    void load();
  }

  async function copyPhone(phone: string | null) {
    if (!phone) return;
    await navigator.clipboard.writeText(phone);
    setCopied(phone);
    setTimeout(() => setCopied(null), 1500);
  }

  const allSelected  = rows.length > 0 && selected.size === rows.length;
  const pmsEligible  = rows.filter(r => selected.has(r.id) && !r.pms_confirmed && r.status !== "cancelled");

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-6xl space-y-3">

        {/* 상단 */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-base font-semibold shrink-0">예약 관리</h1>
          <input
            className="flex-1 min-w-[180px] max-w-xs rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            placeholder="이름 / 전화 / 차량 / 메모 검색"
            value={inputQ}
            onChange={e => setInputQ(e.target.value)}
          />
          <div className="flex gap-2 shrink-0">
            <Link href="/reservations/dashboard"
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">
              대시보드
            </Link>
            <Link href="/reservations/new"
              className="rounded bg-teal-700 px-3 py-1.5 text-xs text-white hover:bg-teal-600">
              + 예약 기록
            </Link>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {(["all","unconfirmed","pms","follow_up"] as StatusFilter[]).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${statusFilter === f ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {STATUS_FILTER_LABEL[f]}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-zinc-700" />
          <div className="flex gap-1">
            {(["today","7d","14d","all"] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${dateFilter === f ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                {DATE_FILTER_LABEL[f]}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-zinc-600">{total}건</span>
        </div>

        {/* bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded border border-zinc-700 bg-zinc-900 px-4 py-2">
            <span className="text-xs text-zinc-300">{selected.size}건 선택</span>
            <button
              onClick={() => setBulkModal(true)}
              disabled={pmsEligible.length === 0}
              className="rounded border border-yellow-700 px-3 py-1 text-xs text-yellow-400 hover:bg-yellow-950 disabled:opacity-40"
            >
              PMS 확인 처리 ({pmsEligible.length}건)
            </button>
            <button onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-zinc-600 hover:text-zinc-400">
              선택 해제
            </button>
          </div>
        )}

        {/* 범례 */}
        <div className="flex gap-4 text-[11px] text-zinc-600 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />미확정</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />PMS 미확인</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />추후연락</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-700" />확정 완료</span>
        </div>

        {/* 리스트 */}
        {loading ? (
          <p className="text-center text-zinc-500 text-sm py-12">로딩...</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">해당 조건의 예약이 없습니다.</p>
        ) : (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-500 font-medium">
              <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll}
                className="accent-teal-500 shrink-0" />
              <span className="w-24 shrink-0">입실일</span>
              <span className="w-14 shrink-0">시간</span>
              <span className="w-24 shrink-0">고객</span>
              <span className="w-32 shrink-0">전화</span>
              <span className="w-24 shrink-0">객실</span>
              <span className="w-20 shrink-0">상태</span>
              <span className="w-12 shrink-0">PMS</span>
              <span className="flex-1 min-w-0">메모</span>
              <span className="w-36 shrink-0 text-right">액션</span>
            </div>

            {/* 데이터 행 */}
            {rows.map(r => (
              <div key={r.id}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm border-b border-zinc-800/50 last:border-0 ${rowHighlight(r)} ${selected.has(r.id) ? "ring-1 ring-inset ring-zinc-600" : ""}`}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                  className="accent-teal-500 shrink-0" />
                <span className="font-mono text-xs text-zinc-300 w-24 shrink-0">{r.check_in_date}</span>
                <span className="text-xs text-zinc-500 w-14 shrink-0">{r.check_in_time ?? "—"}</span>
                <span className="w-24 shrink-0 truncate text-sm font-medium" title={r.guest_name ?? ""}>{r.guest_name ?? "—"}</span>
                <span className="w-32 shrink-0 text-xs text-zinc-400 font-mono">{r.phone_number ?? "—"}</span>
                <span className="w-24 shrink-0 truncate text-xs text-zinc-400" title={r.room_type ?? ""}>{r.room_type ?? "—"}</span>
                <span className={`px-1.5 py-0.5 rounded text-[11px] shrink-0 w-20 text-center ${STATUS_COLOR[r.status] ?? ""}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
                <span className="w-12 shrink-0 text-[11px]">
                  {r.pms_confirmed
                    ? <span className="text-teal-600">PMS✓</span>
                    : <span className="text-zinc-600">—</span>}
                </span>
                <span className="flex-1 min-w-0 text-xs text-zinc-500 truncate" title={r.memo ?? ""}>
                  {r.memo ?? ""}
                </span>

                {/* 액션 */}
                <div className="w-36 shrink-0 flex items-center justify-end gap-1">
                  {r.phone_number && (
                    <>
                      <a href={`tel:${r.phone_number}`}
                        className="px-2 py-0.5 rounded border border-zinc-700 text-xs text-zinc-400 hover:bg-zinc-800">
                        전화
                      </a>
                      <button
                        onClick={() => copyPhone(r.phone_number)}
                        className={`px-2 py-0.5 rounded border text-xs transition-colors ${copied === r.phone_number ? "border-teal-700 text-teal-400" : "border-zinc-700 text-zinc-500 hover:bg-zinc-800"}`}
                        title="번호 복사">
                        {copied === r.phone_number ? "✓" : "복사"}
                      </button>
                    </>
                  )}
                  {!r.pms_confirmed && r.status !== "cancelled" && (
                    <button onClick={() => confirmPms(r.id)}
                      className="px-2 py-0.5 rounded border border-yellow-800 text-xs text-yellow-400 hover:bg-yellow-950">
                      PMS
                    </button>
                  )}
                  {(r.status === "inquiry" || r.status === "tentative") && (
                    <button onClick={() => quickConfirm(r.id)}
                      className="px-2 py-0.5 rounded border border-teal-800 text-xs text-teal-400 hover:bg-teal-950">
                      확정
                    </button>
                  )}
                  <button onClick={() => { setEditing(r); setEditStatus(r.status); setEditMemo(r.memo ?? ""); }}
                    className="px-2 py-0.5 rounded border border-zinc-700 text-xs text-zinc-500 hover:bg-zinc-800">
                    수정
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 수정 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold">예약 수정</h2>
            <p className="text-xs text-zinc-400">{editing.check_in_date} · {editing.guest_name ?? editing.phone_number ?? "—"}</p>
            <div>
              <label className="text-xs text-zinc-400 block mb-2">상태</label>
              <div className="flex flex-wrap gap-2">
                {(["inquiry","tentative","confirmed","follow_up","cancelled"] as const).map(s => (
                  <button key={s} onClick={() => setEditStatus(s)}
                    className={`px-3 py-1 rounded text-xs border ${editStatus === s ? "bg-zinc-600 border-zinc-500" : "border-zinc-700 hover:bg-zinc-800"}`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">메모</label>
              <textarea className="w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm resize-none" rows={2}
                value={editMemo} onChange={e => setEditMemo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="flex-1 rounded bg-teal-700 py-2 text-sm text-white hover:bg-teal-600">저장</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded border border-zinc-600 py-2 text-sm hover:bg-zinc-800">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* bulk PMS 확인 모달 */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-xs rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4 text-center">
            <p className="text-sm font-medium">선택한 {pmsEligible.length}건을 PMS 확인 처리할까요?</p>
            <p className="text-xs text-zinc-500">이미 PMS 확인된 건은 제외됩니다.</p>
            <div className="flex gap-2">
              <button onClick={bulkPmsConfirm}
                className="flex-1 rounded bg-teal-700 py-2 text-sm text-white hover:bg-teal-600">
                확인
              </button>
              <button onClick={() => setBulkModal(false)}
                className="flex-1 rounded border border-zinc-600 py-2 text-sm hover:bg-zinc-800">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DashboardStatsPayload,
  hasMissingPhone,
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

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: number; sub?: string; color: "red" | "yellow" | "orange" | "teal" | "zinc";
}) {
  const colorMap = {
    red:    "border-red-700 bg-red-950/30 text-red-300",
    yellow: "border-yellow-700 bg-yellow-950/30 text-yellow-300",
    orange: "border-orange-700 bg-orange-950/30 text-orange-300",
    teal:   "border-teal-700 bg-teal-950/30 text-teal-300",
    zinc:   "border-zinc-700 bg-zinc-900 text-zinc-300",
  };
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${colorMap[color]}`}>
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

function recorderForPatch(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RESERVATION_RECORDER_STORAGE_KEY)?.trim() || null;
}

export default function ReservationDashboardPage() {
  const [stats, setStats] = useState<DashboardStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function load(d: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/dashboard?date=${d}`);
      const data = (await res.json()) as DashboardStatsPayload;
      setStats(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(date); }, [date]);

  async function confirmPms(id: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pms_confirmed: true, updated_by: recorderForPatch() }),
    });
    void load(date);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-base font-semibold">운영 대시보드</h1>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs focus:outline-none"
            />
            {date !== today && (
              <button
                onClick={() => setDate(today)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                오늘
              </button>
            )}
            <Link href="/reservations"
              className="rounded border border-zinc-600 px-3 py-1.5 text-xs hover:bg-zinc-800">
              대장
            </Link>
            <Link href="/reservations/new"
              className="rounded bg-teal-700 px-3 py-1.5 text-xs text-white hover:bg-teal-600">
              + 예약 기록
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-zinc-500 text-sm py-16">로딩...</p>
        ) : !stats ? (
          <p className="text-center text-zinc-600 text-sm py-16">데이터를 불러올 수 없습니다.</p>
        ) : (
          <>
            <p className="text-[11px] text-zinc-500 mb-3">
              주의 목록 중 전화번호가 비어 있으면 통화 이력과 매칭이 어렵습니다.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard label="오늘 입실 전체" value={stats.total} sub={date} color="zinc" />
              <StatCard
                label="미확정"
                value={stats.unconfirmed}
                sub="문의·구두·추후연락"
                color={stats.unconfirmed > 0 ? "red" : "zinc"}
              />
              <StatCard
                label="PMS 미확인"
                value={stats.pms_missing}
                sub="확인 필요"
                color={stats.pms_missing > 0 ? "yellow" : "zinc"}
              />
              <StatCard
                label="추후연락 미처리"
                value={stats.follow_up_overdue}
                sub="오늘 이전 포함"
                color={stats.follow_up_overdue > 0 ? "orange" : "zinc"}
              />
            </div>

            {stats.danger_list.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  주의 필요 ({stats.danger_list.length}건)
                </h2>
                <div className="space-y-1.5">
                  {stats.danger_list.map((r: ReservationLog) => {
                    const noPhone = hasMissingPhone(r);
                    return (
                    <div key={r.id}
                      className={`rounded-lg border-l-4 border-red-600 bg-red-950/20 px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 items-center text-sm ${noPhone ? "ring-1 ring-rose-900/80" : ""}`}>
                      <span className="font-mono text-xs text-zinc-400 w-20 shrink-0">{r.check_in_date}</span>
                      <span className="text-xs text-zinc-500 w-16 shrink-0">{r.check_in_time ?? "—"}</span>
                      <span className="font-medium w-20 shrink-0">{r.guest_name ?? "—"}</span>
                      <span className="text-zinc-400 text-xs w-28 shrink-0 flex items-center gap-1">
                        {r.phone_number ?? "—"}
                        {noPhone && (
                          <span className="rounded bg-rose-950 text-rose-300 px-1.5 py-0.5 text-[10px] font-medium">전화없음</span>
                        )}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${STATUS_COLOR[r.status] ?? ""}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      <span className="text-[10px] text-zinc-500 shrink-0 max-w-[5rem] truncate" title={r.updated_by ?? r.created_by ?? ""}>
                        {r.updated_by ?? r.created_by ?? "—"}
                      </span>
                      {!r.pms_confirmed && r.status !== "cancelled" && (
                        <button
                          onClick={() => confirmPms(r.id)}
                          className="px-2 py-0.5 rounded text-xs border border-yellow-700 text-yellow-400 hover:bg-yellow-950 shrink-0">
                          PMS확인
                        </button>
                      )}
                      {r.pms_confirmed && (
                        <span className="text-xs text-zinc-600 shrink-0">PMS✓</span>
                      )}
                      {r.memo && (
                        <span className="w-full text-xs text-zinc-500 pl-20">💬 {r.memo}</span>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.danger_list.length === 0 && stats.total > 0 && (
              <div className="rounded-xl border border-teal-800 bg-teal-950/20 p-6 text-center">
                <p className="text-teal-300 text-sm font-medium">✓ 모든 예약이 확정됐습니다</p>
              </div>
            )}

            {stats.total === 0 && (
              <div className="rounded-xl border border-zinc-800 p-6 text-center">
                <p className="text-zinc-500 text-sm">{date} 입실 예약이 없습니다.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

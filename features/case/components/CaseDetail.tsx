"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CaseEventRow, ReservationCaseRow } from "@/features/case/types";

type RiskEnrichedCase = ReservationCaseRow & {
  risk_level: string;
  is_overdue: boolean;
  risk_code: string | null;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default function CaseDetail({ caseId }: { caseId: string }) {
  const [row, setRow] = useState<RiskEnrichedCase | null>(null);
  const [events, setEvents] = useState<CaseEventRow[]>([]);
  const [pending, setPending] = useState(false);
  const [ownerInput, setOwnerInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    checkin_date: "",
    stay_type: "",
    room_type: "",
    people_count: "",
    next_action: "",
    due_at: "",
  });

  const load = useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
      const data = (await res.json()) as { row?: RiskEnrichedCase; events?: CaseEventRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "load failed");
      setRow((data.row as RiskEnrichedCase) ?? null);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setOwnerInput(((data.row as any)?.current_owner as string) ?? "");
      const r = (data.row as any) ?? {};
      setEdit({
        checkin_date: typeof r.checkin_date === "string" ? r.checkin_date.slice(0, 10) : "",
        stay_type: typeof r.stay_type === "string" ? r.stay_type : "",
        room_type: typeof r.room_type === "string" ? r.room_type : "",
        people_count: r.people_count != null ? String(r.people_count) : "",
        next_action: typeof r.next_action === "string" ? r.next_action : "",
        due_at: typeof r.due_at === "string" ? r.due_at.replace("Z", "").slice(0, 16) : "",
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "load failed");
    } finally {
      setPending(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      if (pending) return;
      setPending(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/cases/${caseId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || "action failed");
        setMessage("처리 완료되었습니다");
        setLastAction(
          action === "confirm"
            ? "확인 완료"
            : action === "close_lost"
              ? "종료 처리 완료"
              : action === "mark_pms_registered"
                ? "PMS 입력 완료"
                : action === "mark_room_confirmed"
                  ? "객실 확정 완료"
                  : action === "mark_checkin_time_confirmed"
                    ? "입실시간 확정 완료"
                    : action === "assign"
                      ? "담당자 지정 완료"
                      : "처리 완료",
        );
        await load();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "action failed");
      } finally {
        setPending(false);
      }
    },
    [caseId, load, pending],
  );

  const callLink = useMemo(() => (row?.call_id ? `/calls/${row.call_id}` : null), [row?.call_id]);

  if (!row) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-xl font-semibold">케이스 상세</h1>
        {message ? <p className="mt-3 text-sm text-amber-300">{message}</p> : null}
        {pending ? <p className="mt-3 text-sm text-zinc-400">불러오는 중...</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">케이스 상세</h1>
        <div className="flex gap-2">
          <Link href="/cases" className="rounded border border-zinc-600 px-3 py-1 text-sm">
            보드로
          </Link>
          {callLink ? (
            <Link href={callLink} className="rounded border border-zinc-600 px-3 py-1 text-sm">
              원본 통화 보기
            </Link>
          ) : null}
        </div>
      </div>

      {message ? <p className="mb-3 text-sm text-amber-300">{message}</p> : null}
      {pending ? <p className="mb-3 text-sm text-zinc-400">처리 중...</p> : null}
      {lastAction ? <p className="mb-3 text-sm text-emerald-300">{lastAction}</p> : null}

      <section className="rounded border border-zinc-700 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-semibold">기본 예약 정보</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-400">전화번호</dt>
            <dd className="font-medium">{row.phone_number ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">체크인 날짜</dt>
            <dd className="font-medium">{fmtDate(row.checkin_date)}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">인원</dt>
            <dd className="font-medium">{row.people_count ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">숙박 유형</dt>
            <dd className="font-medium">{row.stay_type ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">상태</dt>
            <dd className="font-medium">{row.state}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">담당자</dt>
            <dd className="font-medium">{row.current_owner ?? "unassigned"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">다음 액션</dt>
            <dd className="font-medium">{row.next_action ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">마감</dt>
            <dd className="font-medium">
              {fmtTime(row.due_at)} {row.is_overdue ? "(지연)" : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-400">위험도</dt>
            <dd className="font-medium">
              {row.risk_level} {row.risk_code ? `(${row.risk_code})` : ""}
            </dd>
          </div>
        </dl>

        <h3 className="mt-5 text-sm font-semibold">체크 플래그</h3>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <Flag label="PMS 등록" value={Boolean(row.is_pms_registered)} />
          <Flag label="객실 확정" value={Boolean(row.is_room_confirmed)} />
          <Flag label="입실시간 확정" value={Boolean(row.is_checkin_time_confirmed)} />
        </div>

        <h3 className="mt-5 text-sm font-semibold">액션</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-emerald-700 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => void act("confirm")}
          >
            {pending ? "처리중…" : "확인(confirmed)"}
          </button>
          <button
            type="button"
            className="rounded border border-rose-700 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => void act("close_lost")}
          >
            {pending ? "처리중…" : "종료(미전환)"}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => void act("mark_pms_registered")}
          >
            {pending ? "처리중…" : "PMS 입력 완료"}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => void act("mark_room_confirmed")}
          >
            {pending ? "처리중…" : "객실 확정"}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => void act("mark_checkin_time_confirmed")}
          >
            {pending ? "처리중…" : "입실시간 확정"}
          </button>
          <div className="flex items-center gap-2">
            <input
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              placeholder="담당자(이름/이메일)"
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              disabled={pending}
            />
            <button
              type="button"
              className="rounded border border-zinc-600 px-3 py-1 text-sm disabled:opacity-60"
              disabled={pending}
              onClick={() => void act("assign", { owner: ownerInput })}
            >
              {pending ? "처리중…" : "담당자 지정"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-zinc-700 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-semibold">핵심 필드 수정</h2>
        <p className="mt-1 text-xs text-zinc-400">수정 사항은 타임라인에 기록됩니다.</p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">checkin_date</span>
            <input
              type="date"
              value={edit.checkin_date}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, checkin_date: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">stay_type</span>
            <select
              value={edit.stay_type}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, stay_type: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              <option value="">(없음)</option>
              <option value="stay">stay</option>
              <option value="dayuse">dayuse</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">room_type</span>
            <input
              value={edit.room_type}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, room_type: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">people_count</span>
            <input
              type="number"
              min={0}
              value={edit.people_count}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, people_count: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-400">next_action</span>
            <input
              value={edit.next_action}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, next_action: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-zinc-400">due_at</span>
            <input
              type="datetime-local"
              value={edit.due_at}
              disabled={pending}
              onChange={(e) => setEdit((p) => ({ ...p, due_at: e.target.value }))}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded border border-cyan-700 px-3 py-1 text-sm disabled:opacity-60"
            disabled={pending}
            onClick={() => {
              const patch: Record<string, unknown> = {};
              patch.checkin_date = edit.checkin_date || null;
              patch.stay_type = edit.stay_type || null;
              patch.room_type = edit.room_type || null;
              patch.people_count = edit.people_count ? Number(edit.people_count) : null;
              patch.next_action = edit.next_action || null;
              patch.due_at = edit.due_at ? new Date(edit.due_at).toISOString() : null;
              void act("update", { patch });
            }}
          >
            {pending ? "처리중…" : "저장"}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded border border-zinc-700 bg-zinc-950/40 p-4">
        <h2 className="text-sm font-semibold">case_events 타임라인</h2>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">아직 이벤트가 없습니다.</p>
          ) : (
            events.map((e) => (
              <article key={e.id} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-xs">
                <div className="text-zinc-300">{fmtTime(e.created_at)}</div>
                <div className="mt-1 text-zinc-100">{e.type ?? "-"}</div>
                <div className="mt-1 text-zinc-400 whitespace-pre-wrap">{e.message ?? "-"}</div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Flag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="rounded border border-zinc-700 bg-zinc-950 p-2">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 text-sm font-medium ${value ? "text-emerald-300" : "text-zinc-300"}`}>
        {value ? "완료" : "미완료"}
      </div>
    </div>
  );
}


"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReservationCaseRow } from "@/features/case/types";

type RiskEnrichedCase = ReservationCaseRow & {
  risk_level: string;
  is_overdue: boolean;
  risk_code: string | null;
};

type UnclassifiedCall = {
  call_id: string;
  phone_number: string | null;
  primary_intent: string | null;
  reason: string;
  created_at: string;
  duration_sec?: number | null;
  confidence?: number | null;
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

export default function CaseBoard() {
  const [cases, setCases] = useState<RiskEnrichedCase[]>([]);
  const [unclassified, setUnclassified] = useState<UnclassifiedCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCaseIds, setPendingCaseIds] = useState<Set<string>>(new Set());
  const [manualDates, setManualDates] = useState<Record<string, string>>({});
  const [lastActionById, setLastActionById] = useState<Record<string, string>>({});
  const isPending = useCallback((id: string) => pendingCaseIds.has(id), [pendingCaseIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [casesRes, unclassifiedRes] = await Promise.all([
        fetch("/api/cases", { cache: "no-store" }),
        fetch("/api/cases/unclassified", { cache: "no-store" }),
      ]);
      const cJson = (await casesRes.json()) as { rows?: RiskEnrichedCase[]; error?: string };
      const uJson = (await unclassifiedRes.json()) as { rows?: UnclassifiedCall[]; error?: string };
      if (!casesRes.ok) throw new Error(cJson.error ?? "cases load failed");
      if (!unclassifiedRes.ok) throw new Error(uJson.error ?? "unclassified load failed");
      setCases(Array.isArray(cJson.rows) ? cJson.rows : []);
      setUnclassified(Array.isArray(uJson.rows) ? uJson.rows : []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reconcile = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cases/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 500 }) });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || "reconcile failed");
      setMessage("처리 완료되었습니다");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "reconcile failed");
    } finally {
      setLoading(false);
    }
  }, [load]);

  const caseAction = useCallback(
    async (
      caseId: string,
      action:
        | "confirm"
        | "close_lost"
        | "mark_pms_registered"
        | "mark_checkin_time_confirmed"
        | "mark_room_confirmed",
    ) => {
      if (isPending(caseId)) return;
      setPendingCaseIds((prev) => new Set(prev).add(caseId));
      setMessage(null);
      try {
        const res = await fetch(`/api/cases/${caseId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || "action failed");
        setMessage("처리 완료되었습니다");
        setLastActionById((prev) => ({
          ...prev,
          [caseId]:
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
                      : "처리 완료",
        }));
        await load();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "action failed");
      } finally {
        setPendingCaseIds((prev) => {
          const next = new Set(prev);
          next.delete(caseId);
          return next;
        });
      }
    },
    [isPending, load],
  );

  const assignOwner = useCallback(
    async (caseId: string, owner: string) => {
      if (isPending(caseId)) return;
      setPendingCaseIds((prev) => new Set(prev).add(caseId));
      setMessage(null);
      try {
        const res = await fetch(`/api/cases/${caseId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign", owner }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || "assign failed");
        setMessage("처리 완료되었습니다");
        setLastActionById((prev) => ({
          ...prev,
          [caseId]: owner.trim() ? `담당자 지정 완료 (${owner.trim()})` : "담당자 지정 완료",
        }));
        await load();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "assign failed");
      } finally {
        setPendingCaseIds((prev) => {
          const next = new Set(prev);
          next.delete(caseId);
          return next;
        });
      }
    },
    [isPending, load],
  );

  const manualCreate = useCallback(
    async (callId: string) => {
      const date = (manualDates[callId] ?? "").trim();
      if (!date) {
        setMessage("체크인 날짜를 입력하세요 (YYYY-MM-DD)");
        return;
      }
      if (isPending(callId)) return;
      setPendingCaseIds((prev) => new Set(prev).add(callId));
      setMessage(null);
      try {
        const res = await fetch("/api/cases/manual-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ call_id: callId, checkin_date: date }),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || "manual create failed");
        setMessage("처리 완료되었습니다");
        setLastActionById((prev) => ({ ...prev, [callId]: `케이스 생성 완료 (${date})` }));
        await load();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "manual create failed");
      } finally {
        setPendingCaseIds((prev) => {
          const next = new Set(prev);
          next.delete(callId);
          return next;
        });
      }
    },
    [isPending, load, manualDates],
  );

  const sortedCases = useMemo(() => {
    const riskRank = (lvl: string) =>
      lvl === "blocking" ? 0 : lvl === "critical" ? 1 : lvl === "warning" ? 2 : 3;
    const dueMs = (iso: string | null) => {
      if (!iso) return Number.POSITIVE_INFINITY;
      const ms = new Date(iso).getTime();
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };
    return [...cases].sort((a, b) => {
      // 1) overdue first
      if (Boolean(a.is_overdue) !== Boolean(b.is_overdue)) return a.is_overdue ? -1 : 1;
      // 2) risk level priority
      const rr = riskRank(a.risk_level) - riskRank(b.risk_level);
      if (rr !== 0) return rr;
      // 3) due_at imminent
      const dm = dueMs(a.due_at) - dueMs(b.due_at);
      if (dm !== 0) return dm;
      // 4) created_at desc
      return b.created_at.localeCompare(a.created_at);
    });
  }, [cases]);

  const todayRisk = useMemo(
    () => sortedCases.filter((c) => c.risk_level !== "normal" || c.is_overdue),
    [sortedCases],
  );
  const myTask = useMemo(
    () => sortedCases.filter((c) => (c.current_owner ?? "") !== "unassigned"),
    [sortedCases],
  );
  const upcoming = useMemo(
    () => sortedCases.filter((c) => c.state === "inquiry" || c.state === "follow_up_needed"),
    [sortedCases],
  );

  const sortedUnclassified = useMemo(() => {
    return [...unclassified].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [unclassified]);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">예약 케이스 운영 보드</h1>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-zinc-600 px-3 py-1 text-sm" onClick={() => void load()} disabled={loading}>
            새로고침
          </button>
          <button type="button" className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900" onClick={() => void reconcile()} disabled={loading}>
            누락 케이스 재탐지/생성
          </button>
          <Link href="/file-review" className="rounded border border-zinc-600 px-3 py-1 text-sm">
            파일 검수로 이동
          </Link>
        </div>
      </div>

      {message ? <p className="mb-3 text-sm text-amber-300">{message}</p> : null}

      <div className="grid gap-3 lg:grid-cols-4">
        <Column title="TODAY RISK" hint="오늘/지연/차단 위험 케이스" items={todayRisk}>
          {todayRisk.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              disabled={loading || isPending(c.id)}
              pending={isPending(c.id)}
              lastAction={lastActionById[c.id] ?? null}
              onConfirm={() => void caseAction(c.id, "confirm")}
              onCloseLost={() => void caseAction(c.id, "close_lost")}
              onMarkPms={() => void caseAction(c.id, "mark_pms_registered")}
              onMarkRoom={() => void caseAction(c.id, "mark_room_confirmed")}
              onMarkCheckinTime={() => void caseAction(c.id, "mark_checkin_time_confirmed")}
              onAssign={(owner) => void assignOwner(c.id, owner)}
            />
          ))}
        </Column>
        <Column title="UPCOMING RISK" hint="곧 체크인/후속 조치 필요" items={upcoming}>
          {upcoming.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              disabled={loading || isPending(c.id)}
              pending={isPending(c.id)}
              lastAction={lastActionById[c.id] ?? null}
              onConfirm={() => void caseAction(c.id, "confirm")}
              onCloseLost={() => void caseAction(c.id, "close_lost")}
              onMarkPms={() => void caseAction(c.id, "mark_pms_registered")}
              onMarkRoom={() => void caseAction(c.id, "mark_room_confirmed")}
              onMarkCheckinTime={() => void caseAction(c.id, "mark_checkin_time_confirmed")}
              onAssign={(owner) => void assignOwner(c.id, owner)}
            />
          ))}
        </Column>
        <Column title="MY TASK" hint="담당자가 지정된 케이스" items={myTask}>
          {myTask.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              disabled={loading || isPending(c.id)}
              pending={isPending(c.id)}
              lastAction={lastActionById[c.id] ?? null}
              onConfirm={() => void caseAction(c.id, "confirm")}
              onCloseLost={() => void caseAction(c.id, "close_lost")}
              onMarkPms={() => void caseAction(c.id, "mark_pms_registered")}
              onMarkRoom={() => void caseAction(c.id, "mark_room_confirmed")}
              onMarkCheckinTime={() => void caseAction(c.id, "mark_checkin_time_confirmed")}
              onAssign={(owner) => void assignOwner(c.id, owner)}
            />
          ))}
        </Column>
        <section className="rounded border border-zinc-700 bg-zinc-950/40 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">UNCLASSIFIED CALL</h2>
              <p className="mt-1 text-xs text-zinc-400">예약 의도는 있으나 날짜가 없어 케이스 미생성</p>
            </div>
            <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">{unclassified.length}</span>
          </div>
          <div className="space-y-2">
            {sortedUnclassified.map((u) => (
              <article
                key={u.call_id}
                className={`rounded border border-zinc-700 bg-zinc-950 p-2 text-xs ${isPending(u.call_id) ? "opacity-70" : ""}`}
              >
                <div className="text-zinc-100">전화번호: {u.phone_number ?? "-"}</div>
                <div className="mt-1 text-zinc-400">의도: {u.primary_intent ?? "-"}</div>
                <div className="mt-1 text-zinc-400">생성: {fmtTime(u.created_at)}</div>
                <div className="mt-1 text-zinc-400">
                  신뢰도: {u.confidence != null ? u.confidence.toFixed(2) : "-"} · 길이:{" "}
                  {u.duration_sec != null ? `${u.duration_sec}s` : "-"}
                </div>
                <div className="mt-2 text-zinc-300">{u.reason}</div>
                {lastActionById[u.call_id] ? (
                  <div className="mt-2 text-xs text-emerald-300">{lastActionById[u.call_id]}</div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Link className="rounded border border-zinc-600 px-2 py-1" href={`/calls/${u.call_id}`}>
                    통화 상세 보기
                  </Link>
                  <input
                    value={manualDates[u.call_id] ?? ""}
                    onChange={(e) =>
                      setManualDates((prev) => ({ ...prev, [u.call_id]: e.target.value }))
                    }
                    placeholder="체크인(YYYY-MM-DD)"
                    className="w-[140px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                    disabled={loading || isPending(u.call_id)}
                  />
                  <button
                    type="button"
                    className="rounded border border-emerald-700 px-2 py-1 disabled:opacity-60"
                    disabled={loading || isPending(u.call_id)}
                    onClick={() => void manualCreate(u.call_id)}
                  >
                    {isPending(u.call_id) ? "처리중…" : "케이스 생성"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Column({
  title,
  hint,
  items,
  children,
}: {
  title: string;
  hint: string;
  items: unknown[];
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-700 bg-zinc-950/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-zinc-400">{hint}</p>
        </div>
        <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function CaseCard({
  c,
  disabled,
  pending,
  lastAction,
  onConfirm,
  onCloseLost,
  onMarkPms,
  onMarkRoom,
  onMarkCheckinTime,
  onAssign,
}: {
  c: RiskEnrichedCase;
  disabled: boolean;
  pending: boolean;
  lastAction: string | null;
  onConfirm: () => void;
  onCloseLost: () => void;
  onMarkPms: () => void;
  onMarkRoom: () => void;
  onMarkCheckinTime: () => void;
  onAssign: (owner: string) => void;
}) {
  const [owner, setOwner] = useState(c.current_owner ?? "");
  return (
    <article className={`rounded border border-zinc-700 bg-zinc-950 p-2 text-xs ${pending ? "opacity-70" : ""}`}>
      <div className="text-zinc-100">
        체크인: {fmtDate(c.checkin_date)} · 인원: {c.people_count ?? "-"}
      </div>
      <div className="mt-1 text-zinc-400">상태: {c.state}</div>
      <div className="mt-1 text-zinc-400">위험도: {c.risk_level}{c.risk_code ? ` (${c.risk_code})` : ""}</div>
      <div className="mt-1 text-zinc-400">다음 액션: {c.next_action ?? "-"}</div>
      <div className="mt-1 text-zinc-400">마감: {fmtTime(c.due_at)}</div>
      <div className="mt-1 text-zinc-400">담당: {c.current_owner ?? "unassigned"}</div>
      {lastAction ? <div className="mt-2 text-xs text-emerald-300">{lastAction}</div> : null}
      <div className="mt-2 flex gap-2">
        <Link className="rounded border border-zinc-600 px-2 py-1" href={`/calls/${c.call_id ?? ""}`}>
          통화 보기
        </Link>
        <Link className="rounded border border-zinc-600 px-2 py-1" href={`/cases/${c.id}`}>
          상세 보기
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="rounded border border-emerald-700 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={onConfirm}>
          {pending ? "처리중…" : "확인"}
        </button>
        <button type="button" className="rounded border border-rose-700 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={onCloseLost}>
          {pending ? "처리중…" : "종료"}
        </button>
        <button type="button" className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={onMarkPms}>
          {pending ? "처리중…" : "PMS 입력 완료"}
        </button>
        <button type="button" className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={onMarkRoom}>
          {pending ? "처리중…" : "객실 확정"}
        </button>
        <button type="button" className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={onMarkCheckinTime}>
          {pending ? "처리중…" : "입실시간 확정"}
        </button>
        <div className="flex items-center gap-2">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="담당자"
            className="w-[140px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            disabled={disabled}
          />
          <button type="button" className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-60" disabled={disabled} onClick={() => onAssign(owner)}>
            {pending ? "처리중…" : "지정"}
          </button>
        </div>
      </div>
    </article>
  );
}


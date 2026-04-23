"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallListRow, LastActivitySnippet } from "@/lib/db/callDashboard";
import type { HandlingStatus } from "@/lib/types/database";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const HANDLING_LABEL: Record<HandlingStatus, string> = {
  new:                  "신규",
  in_progress:          "진행중",
  done:                 "완료",
  need_property_reply:  "업장 회신 필요",
  waiting_customer:     "고객 회신 기다림",
  follow_up_needed:     "추후 확인 필요",
};

const STATUS_BADGE: Record<HandlingStatus, string> = {
  new:                  "bg-zinc-100 text-zinc-500",
  in_progress:          "bg-blue-100 text-blue-700",
  done:                 "bg-green-100 text-green-700",
  need_property_reply:  "bg-orange-100 text-orange-700",
  waiting_customer:     "bg-yellow-100 text-yellow-800",
  follow_up_needed:     "bg-amber-100 text-amber-700",
};

// 대표 액션 정의
interface PrimaryAction {
  label: string;
  nextStatus: HandlingStatus | null; // null = 변경 없음
  style: string;
}

const PRIMARY_ACTION: Record<HandlingStatus, PrimaryAction> = {
  new:                  { label: "처리 시작",     nextStatus: "in_progress",      style: "bg-blue-600 hover:bg-blue-700 text-white" },
  in_progress:          { label: "진행중",        nextStatus: null,               style: "bg-blue-50 text-blue-600 border border-blue-200" },
  need_property_reply:  { label: "업장 확인",     nextStatus: "in_progress",      style: "bg-orange-500 hover:bg-orange-600 text-white" },
  waiting_customer:     { label: "고객 재연락",   nextStatus: "in_progress",      style: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  follow_up_needed:     { label: "후속 처리",     nextStatus: "in_progress",      style: "bg-amber-500 hover:bg-amber-600 text-white" },
  done:                 { label: "완료",          nextStatus: null,               style: "bg-green-50 text-green-600 border border-green-200 cursor-default" },
};

// 상태별 row 배경
function rowBg(status: HandlingStatus, overdue: boolean): string {
  if (overdue && status !== "done") {
    return "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-800";
  }
  switch (status) {
    case "need_property_reply": return "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800";
    case "waiting_customer":    return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800";
    case "follow_up_needed":    return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800";
    case "in_progress":         return "bg-blue-50/40 border-blue-200 dark:bg-blue-950/10 dark:border-blue-800";
    case "done":                return "bg-white border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 opacity-55";
    default:                    return "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700";
  }
}

// 왼쪽 액센트 바 색상
function accentColor(status: HandlingStatus, overdue: boolean): string {
  if (overdue && status !== "done") return "bg-red-500";
  switch (status) {
    case "need_property_reply": return "bg-orange-400";
    case "waiting_customer":    return "bg-yellow-400";
    case "follow_up_needed":    return "bg-amber-400";
    case "in_progress":         return "bg-blue-400";
    case "done":                return "bg-green-300";
    default:                    return "bg-zinc-200";
  }
}

// 처리 필요 상태 우선순위 (낮을수록 먼저)
const STATUS_PRIORITY: Record<HandlingStatus, number> = {
  need_property_reply: 1,
  waiting_customer:    2,
  follow_up_needed:    3,
  new:                 4,
  in_progress:         5,
  done:                9,
};

const RECORDER_KEY = "stay_ops_reservation_recorder";

type ViewMode = "pending" | "all" | "done";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface CallQueueRow extends CallListRow {
  _updating?: boolean;
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return isToday ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function fmtNextAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return isToday ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function activityLabel(a: LastActivitySnippet): string {
  switch (a.event_type) {
    case "status_changed":
      return `상태 → ${HANDLING_LABEL[a.payload.to as HandlingStatus] ?? a.payload.to}`;
    case "assignee_changed":
      return `담당자 → ${a.payload.to ?? "—"}`;
    case "next_action_set":
      return `다음액션: ${a.payload.next_action ?? "—"}`;
    case "note_added":
      return String(a.payload.note ?? "");
    default:
      return a.event_type;
  }
}

function sortRows(rows: CallQueueRow[]): CallQueueRow[] {
  return [...rows].sort((a, b) => {
    // 1순위: next_action_at asc, nulls last
    const aAt = a.next_action_at ? new Date(a.next_action_at).getTime() : Infinity;
    const bAt = b.next_action_at ? new Date(b.next_action_at).getTime() : Infinity;
    if (aAt !== bAt) return aAt - bAt;

    // 2순위: status priority
    const aSt = STATUS_PRIORITY[(a.handling_status ?? "new") as HandlingStatus] ?? 9;
    const bSt = STATUS_PRIORITY[(b.handling_status ?? "new") as HandlingStatus] ?? 9;
    if (aSt !== bSt) return aSt - bSt;

    // 3순위: created_at desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ─── 상세 패널 ────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string;
  event_type: string;
  actor: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function eventLabel(e: ActivityLog): string {
  switch (e.event_type) {
    case "status_changed":
      return `상태: ${HANDLING_LABEL[e.payload.from as HandlingStatus] ?? e.payload.from} → ${HANDLING_LABEL[e.payload.to as HandlingStatus] ?? e.payload.to}`;
    case "assignee_changed":
      return `담당자: ${e.payload.from ?? "—"} → ${e.payload.to ?? "—"}`;
    case "next_action_set":
      return `다음액션: ${e.payload.next_action ?? "—"}`;
    case "note_added":
      return `메모: ${e.payload.note}`;
    default:
      return e.event_type;
  }
}

function DetailPanel({
  row,
  actor,
  onUpdate,
  onClose,
}: {
  row: CallQueueRow;
  actor: string;
  onUpdate: (id: string, patch: object) => Promise<void>;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [noteText, setNoteText] = useState("");
  const [nextAction, setNextAction] = useState(row.next_action ?? "");
  const [nextActionAt, setNextActionAt] = useState(
    row.next_action_at ? row.next_action_at.slice(0, 16) : "",
  );
  const [assignee, setAssignee] = useState(row.assignee ?? "");
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/calls/${row.id}/activity`);
    if (res.ok) setLogs(await res.json());
  }, [row.id]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function saveFields() {
    setSaving(true);
    await onUpdate(row.id, {
      assignee: assignee || null,
      next_action: nextAction || null,
      next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
    });
    setSaving(false);
  }

  async function submitNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    await fetch(`/api/calls/${row.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText.trim(), actor: actor || undefined }),
    });
    setNoteText("");
    await fetchLogs();
    setSaving(false);
  }

  const status = (row.handling_status ?? "new") as HandlingStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                {HANDLING_LABEL[status]}
              </span>
              <span className="text-xs text-zinc-400">{row.phone_number ?? "번호없음"}</span>
              <span className="text-xs text-zinc-400">{fmtDate(row.created_at)}</span>
            </div>
            {row.summary ? (
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {row.summary}
              </p>
            ) : null}
            {(row.primary_intent || row.manual_classification) ? (
              <p className="mt-0.5 text-xs text-zinc-400">
                {row.manual_classification ?? row.primary_intent}
              </p>
            ) : null}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-2xl leading-none mt-0.5">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">담당자</label>
              <input
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
                value={assignee}
                placeholder="이름"
                onChange={(e) => setAssignee(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">다음 액션 일시</label>
              <input
                type="datetime-local"
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">다음 액션 내용</label>
            <input
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
              value={nextAction}
              placeholder="다음에 해야 할 일..."
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={saveFields}
              className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
            >
              저장
            </button>
            {status !== "done" && (
              <button
                disabled={saving}
                onClick={() => onUpdate(row.id, { handling_status: "done" })}
                className="px-4 bg-green-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
              >
                완료 처리
              </button>
            )}
          </div>

          {logs.length > 0 && (
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-2">처리 이력</div>
              <ul className="space-y-1.5">
                {logs.map((l) => (
                  <li key={l.id} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="shrink-0 text-zinc-400 w-16">{fmtDate(l.created_at)}</span>
                    <span>{l.actor ? `[${l.actor}] ` : ""}{eventLabel(l)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-zinc-500 mb-2">메모 추가</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
                placeholder="메모 내용..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }}
              />
              <button
                disabled={saving || !noteText.trim()}
                onClick={submitNote}
                className="px-3 py-1.5 bg-zinc-800 text-white rounded text-sm disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 상태 드롭다운 ────────────────────────────────────────────────────────────

const ALL_STATUSES: HandlingStatus[] = [
  "new", "in_progress", "need_property_reply", "waiting_customer", "follow_up_needed", "done",
];

function StatusDropdown({
  row,
  onUpdate,
}: {
  row: CallQueueRow;
  onUpdate: (id: string, patch: object) => Promise<void>;
}) {
  const status = (row.handling_status ?? "new") as HandlingStatus;
  return (
    <select
      disabled={row._updating}
      value={status}
      className={`rounded-full px-2 py-0.5 text-xs font-semibold border-0 cursor-pointer ${STATUS_BADGE[status]}`}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        e.stopPropagation();
        await onUpdate(row.id, { handling_status: e.target.value });
      }}
    >
      {ALL_STATUSES.map((s) => (
        <option key={s} value={s}>{HANDLING_LABEL[s]}</option>
      ))}
    </select>
  );
}

// ─── 콜 카드 ─────────────────────────────────────────────────────────────────

function CallCard({
  row,
  currentActor,
  onUpdate,
  onClick,
}: {
  row: CallQueueRow;
  currentActor: string;
  onUpdate: (id: string, patch: object) => Promise<void>;
  onClick: () => void;
}) {
  const status = (row.handling_status ?? "new") as HandlingStatus;
  const overdue = isOverdue(row.next_action_at);
  const action = PRIMARY_ACTION[status];
  const isMyTask = currentActor && row.assignee === currentActor;

  return (
    <div
      onClick={onClick}
      className={`relative flex gap-0 rounded-xl border cursor-pointer hover:shadow-sm transition-all overflow-hidden ${rowBg(status, overdue)}`}
    >
      {/* 왼쪽 액센트 바 */}
      <div className={`w-1 shrink-0 ${accentColor(status, overdue)}`} />

      {/* 본문 */}
      <div className="flex-1 min-w-0 px-3 py-3">
        {/* 1행: summary */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {row.summary ? (
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                {row.summary}
              </p>
            ) : (
              <p className="text-sm font-semibold text-zinc-400 italic">요약 없음</p>
            )}
          </div>
          {overdue && status !== "done" && (
            <span className="shrink-0 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
              지연됨
            </span>
          )}
        </div>

        {/* 2행: intent + 전화번호 */}
        <p className="mt-0.5 text-xs text-zinc-400 truncate">
          {row.manual_classification ?? row.primary_intent ?? "—"}
          {row.phone_number && <span className="ml-2">· {row.phone_number}</span>}
          {row.created_at && <span className="ml-2">· {fmtDate(row.created_at)}</span>}
        </p>

        {/* 3행: 다음 액션 */}
        {row.next_action && (
          <div className={`mt-1.5 flex items-center gap-1 text-xs ${overdue ? "text-red-600 font-medium" : "text-zinc-500"}`}>
            <span>{overdue ? "⏰" : "→"}</span>
            <span className="truncate">{row.next_action}</span>
            {row.next_action_at && (
              <span className={`shrink-0 font-medium ${overdue ? "text-red-500" : "text-zinc-400"}`}>
                {fmtNextAt(row.next_action_at)}
              </span>
            )}
          </div>
        )}

        {/* 4행: 마지막 activity log */}
        {row.last_activity && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="shrink-0">{fmtDate(row.last_activity.created_at)}</span>
            {row.last_activity.actor && (
              <span className="font-medium text-zinc-500">{row.last_activity.actor}</span>
            )}
            <span className="truncate">— {activityLabel(row.last_activity)}</span>
          </div>
        )}
      </div>

      {/* 오른쪽 패널 */}
      <div
        className="flex flex-col items-end justify-between px-3 py-3 shrink-0 gap-2 min-w-[120px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상태 드롭다운 */}
        <StatusDropdown row={row} onUpdate={onUpdate} />

        {/* 대표 액션 버튼 */}
        {action.nextStatus ? (
          <button
            disabled={row._updating}
            onClick={async () => {
              if (action.nextStatus) {
                await onUpdate(row.id, { handling_status: action.nextStatus });
              }
            }}
            className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-center transition-colors disabled:opacity-50 ${action.style}`}
          >
            {action.label}
          </button>
        ) : (
          <span className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold text-center ${action.style}`}>
            {action.label}
          </span>
        )}

        {/* 담당자 */}
        <div className={`text-xs font-medium text-right ${isMyTask ? "text-blue-600" : "text-zinc-400"}`}>
          {row.assignee ?? <span className="text-zinc-300">미지정</span>}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function CallsPage() {
  const [rows, setRows] = useState<CallQueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewMode>("pending");
  const [myOnly, setMyOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<HandlingStatus | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CallQueueRow | null>(null);
  const [actor, setActor] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 50;

  useEffect(() => {
    const stored = localStorage.getItem(RECORDER_KEY);
    if (stored) setActor(stored);
  }, []);

  const fetchRows = useCallback(
    async (
      v: ViewMode,
      status: HandlingStatus | "",
      mine: boolean,
      myName: string,
      p: number,
    ) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(p) });
        if (v === "pending") sp.set("pending_only", "1");
        else if (v === "done") sp.set("handling_status", "done");
        else if (status) sp.set("handling_status", status);
        if (mine && myName.trim()) sp.set("assignee", myName.trim());
        const res = await fetch(`/api/calls?${sp.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setRows((data.calls ?? []) as CallQueueRow[]);
        setTotal(data.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchRows(view, filterStatus, myOnly, actor, page);
  }, [fetchRows, view, filterStatus, myOnly, actor, page]);

  function setViewMode(v: ViewMode) {
    setView(v);
    setFilterStatus("");
    setPage(1);
  }

  async function patchCall(id: string, patch: object) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, _updating: true } : r)));
    await fetch(`/api/calls/${id}/handle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, actor: actor || undefined }),
    });
    await fetchRows(view, filterStatus, myOnly, actor, page);
    setSelected((prev) =>
      prev?.id === id ? { ...prev, ...(patch as Partial<CallQueueRow>) } : prev,
    );
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sorted = sortRows(rows);

  const pendingCount = view === "pending" ? total : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">콜 처리 큐</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {pendingCount !== null ? `처리 필요 ${pendingCount}건` : `총 ${total}건`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs">담당자</span>
          <input
            className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-2.5 py-1.5 text-sm w-24 bg-white dark:bg-zinc-800"
            placeholder="이름"
            defaultValue={actor}
            onChange={(e) => {
              setActor(e.target.value);
              localStorage.setItem(RECORDER_KEY, e.target.value);
            }}
          />
        </div>
      </div>

      {/* 뷰 탭 */}
      <div className="flex items-center gap-2 mb-3">
        {(["pending", "all", "done"] as ViewMode[]).map((v) => {
          const label = v === "pending" ? "처리 필요" : v === "all" ? "전체" : "완료";
          return (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                view === v
                  ? v === "pending"
                    ? "bg-red-600 text-white border-red-600"
                    : v === "done"
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-zinc-800 text-white border-zinc-800"
                  : "bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
              }`}
            >
              {label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {/* 내 담당 토글 */}
          <button
            disabled={!actor.trim()}
            onClick={() => { setMyOnly((v) => !v); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-30 ${
              myOnly
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            내 담당
          </button>
        </div>
      </div>

      {/* 세부 상태 필터 (전체 뷰일 때만 표시) */}
      {view === "all" && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {([
            { value: "" as HandlingStatus | "", label: "전체 상태" },
            { value: "new" as HandlingStatus, label: "신규" },
            { value: "in_progress" as HandlingStatus, label: "진행중" },
            { value: "need_property_reply" as HandlingStatus, label: "업장 회신" },
            { value: "waiting_customer" as HandlingStatus, label: "고객 대기" },
            { value: "follow_up_needed" as HandlingStatus, label: "추후 확인" },
          ] as { value: HandlingStatus | ""; label: string }[]).map((s) => (
            <button
              key={s.value}
              onClick={() => { setFilterStatus(s.value); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                filterStatus === s.value
                  ? "bg-zinc-700 text-white border-zinc-700"
                  : "bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-400">불러오는 중...</div>
      ) : sorted.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-zinc-400">
            {view === "pending" ? "처리할 콜이 없습니다 ✓" : "조회된 콜이 없습니다"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((row) => (
            <CallCard
              key={row.id}
              row={row}
              currentActor={actor}
              onUpdate={patchCall}
              onClick={() => setSelected(row)}
            />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {pages > 1 && (
        <div className="flex items-center gap-3 mt-6 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-zinc-400">{page} / {pages}</span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}

      {/* 상세 패널 */}
      {selected && (
        <DetailPanel
          row={selected}
          actor={actor}
          onUpdate={patchCall}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

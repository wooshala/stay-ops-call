"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DraftPayload, ReservationDraftRow } from "@/lib/db/reservationDrafts";
import { RESERVATION_RECORDER_STORAGE_KEY, STATUS_LABEL } from "@/lib/db/reservations";

function payloadFromJson(d: Record<string, unknown>): DraftPayload | null {
  try {
    if (!d.check_in_date || typeof d.check_in_date !== "string") return null;
    return {
      phone_number: (d.phone_number as string) ?? null,
      guest_name: (d.guest_name as string) ?? null,
      check_in_date: d.check_in_date as string,
      check_in_time: (d.check_in_time as string) ?? null,
      room_type: (d.room_type as string) ?? null,
      vehicle_info: (d.vehicle_info as string) ?? null,
      occupancy_count:
        typeof d.occupancy_count === "number"
          ? d.occupancy_count
          : typeof d.occupancy_count === "string"
            ? Number(d.occupancy_count) || null
            : null,
      status: (d.status as DraftPayload["status"]) ?? "inquiry",
      memo: (d.memo as string) ?? null,
    };
  } catch {
    return null;
  }
}

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<ReservationDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [editOpen, setEditOpen] = useState<ReservationDraftRow | null>(null);
  const [editForm, setEditForm] = useState<DraftPayload | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(RESERVATION_RECORDER_STORAGE_KEY)?.trim();
      if (v) setReviewer(v);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals?status=pending");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "load failed");
      const rows: ReservationDraftRow[] = Array.isArray(payload)
        ? payload
        : (payload?.drafts ?? []);
      console.log("[approvals] fetched rows:", rows.length, rows);
      setDrafts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function postJson(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data;
  }

  async function handleApprove(id: string) {
    setActing(id);
    try {
      await postJson(`/api/approvals/${id}/approve`, {
        reviewed_by: reviewer.trim() || null,
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setActing(null);
    }
  }

  async function handleDismiss(id: string) {
    if (!confirm("이 초안을 무시할까요? (시트에 기록되지 않습니다)")) return;
    setActing(id);
    try {
      await postJson(`/api/approvals/${id}/dismiss`, {
        reviewed_by: reviewer.trim() || null,
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setActing(null);
    }
  }

  function openEdit(d: ReservationDraftRow) {
    const p = payloadFromJson(d.draft_json);
    if (!p) {
      alert("draft_json 형식이 올바르지 않습니다.");
      return;
    }
    setEditForm(p);
    setEditOpen(d);
  }

  async function submitEdit() {
    if (!editOpen || !editForm) return;
    setActing(editOpen.id);
    try {
      await postJson(`/api/approvals/${editOpen.id}/approve-edit`, {
        reviewed_by: reviewer.trim() || null,
        patch: editForm,
      });
      setEditOpen(null);
      setEditForm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-white">AI 예약 초안 승인</h1>
            <p className="mt-1 text-xs text-zinc-500">
              승인 시 <code className="text-zinc-400">AI_예약로그</code> 시트에 한 줄 추가되고, 수동 예약 대장에도 반영됩니다.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-zinc-500">검수자 (선택)</label>
            <input
              className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-white"
              placeholder="이름"
              value={reviewer}
              onChange={(e) => {
                const v = e.target.value;
                setReviewer(v);
                try {
                  localStorage.setItem(RESERVATION_RECORDER_STORAGE_KEY, v);
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </div>

        {loading && <p className="text-sm text-zinc-500">불러오는 중…</p>}
        {error && (
          <p className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {!loading && !error && drafts.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            대기 중인 초안이 없습니다. AI 파이프라인에서{" "}
            <code className="text-zinc-400">reservation_drafts</code>에 insert 되면 여기에 표시됩니다.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {drafts.map((d) => {
            const p = payloadFromJson(d.draft_json);
            const dj = d.draft_json as Record<string, unknown>;
            const src = typeof dj.source === "string" ? dj.source : null;
            const sumExtra =
              typeof dj.summary === "string" ? dj.summary : null;
            const intentExtra =
              typeof dj.primary_intent === "string" ? dj.primary_intent : null;
            return (
              <div
                key={d.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-zinc-500">{d.id.slice(0, 8)}…</span>
                    <span className="text-[10px] text-zinc-600">
                      생성 {new Date(d.created_at).toLocaleString("ko-KR")}
                    </span>
                    {src === "call_analysis" ? (
                      <span className="text-[10px] text-teal-500/90">자동 · 통화 분석</span>
                    ) : null}
                  </div>
                  {d.call_id ? (
                    <div className="text-right space-y-1">
                      <span className="block text-[10px] text-zinc-600 font-mono">
                        call {d.call_id.slice(0, 8)}…
                      </span>
                      <Link
                        href={`/calls/${d.call_id}`}
                        className="text-[11px] text-blue-400 hover:underline"
                      >
                        원문 통화 →
                      </Link>
                    </div>
                  ) : null}
                </div>
                {p ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-zinc-500">입실일</dt>
                    <dd className="text-zinc-200">{p.check_in_date}</dd>
                    <dt className="text-zinc-500">전화</dt>
                    <dd className="text-zinc-200">{p.phone_number ?? "—"}</dd>
                    <dt className="text-zinc-500">고객</dt>
                    <dd className="text-zinc-200">{p.guest_name ?? "—"}</dd>
                    <dt className="text-zinc-500">상태</dt>
                    <dd className="text-zinc-200">{STATUS_LABEL[p.status]}</dd>
                    {intentExtra ? (
                      <>
                        <dt className="text-zinc-500">의도</dt>
                        <dd className="text-zinc-400 font-mono text-[10px]">{intentExtra}</dd>
                      </>
                    ) : null}
                    {sumExtra && sumExtra !== p.memo ? (
                      <>
                        <dt className="text-zinc-500 col-span-2">요약</dt>
                        <dd className="text-zinc-400 col-span-2 line-clamp-3">{sumExtra}</dd>
                      </>
                    ) : null}
                    {p.memo && (
                      <>
                        <dt className="text-zinc-500 col-span-2">메모</dt>
                        <dd className="text-zinc-400 col-span-2 line-clamp-3">{p.memo}</dd>
                      </>
                    )}
                  </dl>
                ) : (
                  <pre className="text-[10px] text-amber-400 overflow-x-auto max-h-32">
                    {JSON.stringify(d.draft_json, null, 2)}
                  </pre>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={acting === d.id}
                    onClick={() => handleApprove(d.id)}
                    className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={acting === d.id}
                    onClick={() => openEdit(d)}
                    className="rounded border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    수정 후 승인
                  </button>
                  <button
                    type="button"
                    disabled={acting === d.id}
                    onClick={() => handleDismiss(d.id)}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    무시
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editOpen && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold text-white mb-3">수정 후 승인</h2>
            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="text-zinc-500">입실일 *</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.check_in_date}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, check_in_date: e.target.value } : f))
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">전화</span>
                <input
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.phone_number ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, phone_number: e.target.value || null } : f))
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">고객명</span>
                <input
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.guest_name ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, guest_name: e.target.value || null } : f))
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">입실 시간</span>
                <input
                  type="time"
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.check_in_time ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, check_in_time: e.target.value || null } : f))
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">객실/타입</span>
                <input
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.room_type ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, room_type: e.target.value || null } : f))
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">인원</span>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.occupancy_count ?? ""}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f
                        ? {
                            ...f,
                            occupancy_count: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : f,
                    )
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">상태</span>
                <select
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) =>
                      f ? { ...f, status: e.target.value as DraftPayload["status"] } : f,
                    )
                  }
                >
                  {(
                    [
                      "inquiry",
                      "tentative",
                      "confirmed",
                      "follow_up",
                      "cancelled",
                    ] as const
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-zinc-500">메모</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-white"
                  value={editForm.memo ?? ""}
                  onChange={(e) =>
                    setEditForm((f) => (f ? { ...f, memo: e.target.value || null } : f))
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={submitEdit}
                disabled={acting === editOpen.id}
                className="flex-1 rounded bg-teal-700 py-2 text-sm text-white hover:bg-teal-600 disabled:opacity-50"
              >
                저장 후 시트 반영
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(null);
                  setEditForm(null);
                }}
                className="flex-1 rounded border border-zinc-600 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

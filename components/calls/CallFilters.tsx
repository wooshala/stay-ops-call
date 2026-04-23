"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

const INTENTS = [
  "",
  "maintenance",
  "service_request",
  "reservation_inquiry",
  "rate_inquiry",
  "extension_request",
  "complaint",
  "other",
];

const TRI = [
  { value: "", label: "전체" },
  { value: "yes", label: "예" },
  { value: "no", label: "아니오" },
];

export function CallFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [intent, setIntent] = useState(sp.get("intent") ?? "");
  const [phone, setPhone] = useState(sp.get("phone") ?? "");
  const [roomHint, setRoomHint] = useState(
    sp.get("room_hint") ?? sp.get("room_no") ?? "",
  );
  const [roomNoPresent, setRoomNoPresent] = useState(sp.get("room_no_present") ?? "");
  const [workflowCreated, setWorkflowCreated] = useState(
    sp.get("workflow_created") ?? "",
  );
  const [hasError, setHasError] = useState(sp.get("has_error") ?? "");

  const apply = useCallback(() => {
    const q = new URLSearchParams();
    if (intent.trim()) q.set("intent", intent.trim());
    if (phone.trim()) q.set("phone", phone.trim());
    if (roomHint.trim()) q.set("room_hint", roomHint.trim());
    if (roomNoPresent) q.set("room_no_present", roomNoPresent);
    if (workflowCreated) q.set("workflow_created", workflowCreated);
    if (hasError) q.set("has_error", hasError);
    q.set("page", "1");
    router.push(`/calls?${q.toString()}`);
  }, [intent, phone, roomHint, roomNoPresent, workflowCreated, hasError, router]);

  const clear = useCallback(() => {
    setIntent("");
    setPhone("");
    setRoomHint("");
    setRoomNoPresent("");
    setWorkflowCreated("");
    setHasError("");
    router.push("/calls");
  }, [router]);

  return (
    <div className="mb-6 flex flex-col gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">primary_intent</span>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">전체</option>
            {INTENTS.filter(Boolean).map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010..."
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">room_no_hint (검색)</span>
          <input
            value={roomHint}
            onChange={(e) => setRoomHint(e.target.value)}
            placeholder="605"
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">엔티티 room_no 있음</span>
          <select
            value={roomNoPresent}
            onChange={(e) => setRoomNoPresent(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {TRI.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">워크플로 생성됨</span>
          <select
            value={workflowCreated}
            onChange={(e) => setWorkflowCreated(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {TRI.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">에러 있음 (STT/분석)</span>
          <select
            value={hasError}
            onChange={(e) => setHasError(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {TRI.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          필터 적용
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          초기화
        </button>
      </div>
    </div>
  );
}

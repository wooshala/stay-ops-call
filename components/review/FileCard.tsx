"use client";

import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties, MouseEvent } from "react";

type ReviewStage = "raw" | "review" | "failed" | "passed";

type Props = {
  id: string;
  name: string;
  sizeLabel: string;
  createdAtLabel: string;
  statusLabel: string;
  stage: ReviewStage;
  infoLines?: string[];
  tone?: "raw" | "tested" | "failed" | "passed";
  selected?: boolean;
  onSelect?: () => void;
  onAnalyze?: () => void;
  onDetail?: () => void;
  onPass?: () => void;
  onFail?: () => void;
  onReanalyze?: () => void;
  actionsDisabled?: boolean;
};

const DEBUG_REVIEW = process.env.NODE_ENV === "development";

export default function FileCard({
  id,
  name,
  sizeLabel,
  createdAtLabel,
  statusLabel,
  stage,
  infoLines = [],
  tone = "raw",
  selected = false,
  onSelect,
  onAnalyze,
  onDetail,
  onPass,
  onFail,
  onReanalyze,
  actionsDisabled = false,
}: Props) {
  if (DEBUG_REVIEW) {
    console.log("[review-debug] FILE_CARD_RENDER", {
      id,
      stage,
      hasOnSelect: typeof onSelect === "function",
      hasOnPass: typeof onPass === "function",
      hasOnFail: typeof onFail === "function",
      hasOnReanalyze: typeof onReanalyze === "function",
      hasOnDetail: typeof onDetail === "function",
    });
  }

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card:${id}`,
    data: { stage, id },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : actionsDisabled ? 0.7 : 1,
  };

  const toneClass =
    tone === "passed"
      ? "border-emerald-700"
      : tone === "failed"
        ? "border-rose-700"
        : tone === "tested"
          ? "border-amber-700"
          : "border-zinc-700";

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-id={id}
      className={`rounded border bg-zinc-950 p-2 text-xs ${toneClass}`}
    >
      <button
        type="button"
        className="mb-2 inline-flex cursor-grab rounded border border-zinc-700 px-2 py-1 text-zinc-300 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        disabled={actionsDisabled}
        {...listeners}
        {...attributes}
      >
        드래그
      </button>
      <div className="font-mono text-zinc-100">{name}</div>
      <div className="mt-1 text-zinc-400">
        {sizeLabel} · {createdAtLabel}
      </div>
      <div className="mt-1 text-zinc-400">{statusLabel}</div>
      {infoLines.map((line) => (
        <div key={line} className="mt-1 text-zinc-300">
          {line}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-1">
        {onSelect ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED select", id);
              onSelect();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`rounded border px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-emerald-500 text-emerald-300" : "border-zinc-700 text-zinc-300"}`}
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "선택"}
          </button>
        ) : null}
        {onAnalyze ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED analyze", id);
              onAnalyze();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded border border-cyan-700 px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "분석"}
          </button>
        ) : null}
        {onPass ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED verify", id);
              onPass();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded border border-emerald-700 px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "✔ 통과"}
          </button>
        ) : null}
        {onFail ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED reject", id);
              onFail();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded border border-rose-700 px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "✖ 실패"}
          </button>
        ) : null}
        {onReanalyze ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED reanalyze", id);
              onReanalyze();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded border border-amber-700 px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "🔁 재분석"}
          </button>
        ) : null}
        {onDetail ? (
          <button
            type="button"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              if (DEBUG_REVIEW) console.log("[review-debug] CLICKED detail", id);
              onDetail();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded border border-zinc-600 px-2 py-1 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionsDisabled}
          >
            {actionsDisabled ? "처리중..." : "상세 보기"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

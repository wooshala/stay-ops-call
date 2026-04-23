"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

type ReviewStage = "raw" | "review" | "failed" | "passed";

type Props = {
  title: string;
  items: unknown[];
  stage: ReviewStage;
  children: ReactNode;
};

export default function PipelineColumn({ title, items, stage, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage}`,
    data: { stage },
  });

  return (
    <section
      ref={setNodeRef}
      className={`rounded border p-3 ${
        isOver ? "border-emerald-500 bg-emerald-950/20" : "border-zinc-700 bg-zinc-950/40"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

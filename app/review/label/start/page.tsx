"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ReviewLabelStartInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const job = sp.get("job");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!job) {
      setErr("job 쿼리가 필요합니다.");
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/review/jobs/${job}/candidates?filter=pending_only`,
      );
      const data = (await res.json()) as {
        candidates?: Array<{ id: string }>;
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "목록 로드 실패");
        return;
      }
      const first = data.candidates?.[0];
      if (!first) {
        setErr("대기 중인 후보가 없습니다.");
        return;
      }
      if (!cancelled) {
        router.replace(`/review/label/${first.id}?job=${job}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-zinc-500">
      {err ?? "첫 후보로 이동 중…"}
    </div>
  );
}

export default function ReviewLabelStartPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-zinc-500">
          로딩…
        </div>
      }
    >
      <ReviewLabelStartInner />
    </Suspense>
  );
}

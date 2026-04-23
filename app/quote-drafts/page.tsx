import Link from "next/link";

import { listQuoteDraftRows, type QuoteDraftListFilter } from "@/lib/db/quoteDrafts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "견적 초안 목록 · Stay-Ops-Call",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function normalizeFilter(value: string | undefined): QuoteDraftListFilter {
  if (value === "needs_review") return "needs_review";
  if (value === "ready") return "ready";
  return "all";
}

function roomTypeLabel(value: string | null): string {
  if (value === "standard") return "일반실";
  if (value === "deluxe") return "디럭스";
  if (value === "suite") return "스위트";
  return "미선택";
}

function statusLabel(value: string): string {
  if (value === "needs_review") return "확인 필요";
  if (value === "draft") return "draft";
  if (value === "sent") return "sent";
  if (value === "archived") return "archived";
  return value;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return iso;
  }
}

export default async function QuoteDraftsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filter = normalizeFilter(pickString(sp.filter));
  const rows = await listQuoteDraftRows(filter);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">견적 초안 목록</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        최근 저장된 견적 초안을 확인하고 상세 화면으로 이동할 수 있습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/quote-drafts?filter=all"
          className={`rounded border px-3 py-1.5 ${filter === "all" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          전체
        </Link>
        <Link
          href="/quote-drafts?filter=needs_review"
          className={`rounded border px-3 py-1.5 ${filter === "needs_review" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          확인 필요
        </Link>
        <Link
          href="/quote-drafts?filter=ready"
          className={`rounded border px-3 py-1.5 ${filter === "ready" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          발송 준비 완료
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-3">전화번호</th>
              <th className="py-2 pr-3">통화 요약</th>
              <th className="py-2 pr-3">선택 객실</th>
              <th className="py-2 pr-3">상태</th>
              <th className="py-2 pr-3">수정 시각</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.callId}
                className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
              >
                <td className="py-2 pr-3 font-mono">
                  <Link href={`/quote-drafts/${row.callId}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    {row.phoneNumber ?? "없음"}
                  </Link>
                </td>
                <td className="max-w-[28rem] truncate py-2 pr-3" title={row.callSummary}>
                  <Link href={`/quote-drafts/${row.callId}`} className="block text-inherit">
                    {row.callSummary || "요약 없음"}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  <Link href={`/quote-drafts/${row.callId}`} className="block text-inherit">
                    {roomTypeLabel(row.selectedRoomType)}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  <Link href={`/quote-drafts/${row.callId}`} className="block text-inherit">
                    {row.canSend ? "발송 준비 완료" : statusLabel(row.status)}
                  </Link>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                  <Link href={`/quote-drafts/${row.callId}`} className="block text-inherit">
                    {fmtTime(row.updatedAt)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">조건에 맞는 견적 초안이 없습니다.</p>
      ) : null}
    </main>
  );
}

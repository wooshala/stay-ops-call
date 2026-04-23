import Link from "next/link";

import { listQuoteIdsWithFailedMessages, listQuotes } from "@/lib/db/quotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes Review · Stay-Ops-Call" };

export default async function QuotesReviewPage() {
  const [rows, failedIds] = await Promise.all([
    listQuotes({}),
    listQuoteIdsWithFailedMessages(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quotes Review</h1>
      <p className="mt-2 text-sm text-zinc-600">
        needs_review=true 또는 발송 실패 사유(failure_reason)가 있는 견적을 확인합니다.
      </p>
      <div className="mt-4">
        <Link href="/quotes" className="text-sm text-blue-600 hover:underline">
          ← quotes 목록
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3">status</th>
              <th className="py-2 pr-3">phone</th>
              <th className="py-2 pr-3">failure_reason</th>
              <th className="py-2 pr-3">updated</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((q) => q.needs_review || failedIds.has(q.id))
              .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
              .map((q) => (
                <tr key={q.id} className="border-b">
                  <td className="py-2 pr-3">
                    <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:underline">
                      {q.status}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 font-mono">{q.customer_phone ?? "—"}</td>
                  <td className="py-2 pr-3 text-amber-700">
                    {q.failure_reason ?? (failedIds.has(q.id) ? "발송 실패 이력" : "검토 필요")}
                  </td>
                  <td className="py-2 pr-3 text-xs">{new Date(q.updated_at).toISOString().slice(0, 19)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

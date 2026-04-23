import Link from "next/link";

import { listQuotes, type QuoteSource, type QuoteStatus } from "@/lib/db/quotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes · Stay-Ops-Call" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function pick(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function QuotesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = pick(sp.status) as QuoteStatus | undefined;
  const source = pick(sp.source) as QuoteSource | undefined;
  const phone = pick(sp.phone);
  const needsReviewRaw = pick(sp.needs_review);
  const hasSendHistoryRaw = pick(sp.has_send_history);
  const needsReview =
    needsReviewRaw === "true" ? true : needsReviewRaw === "false" ? false : undefined;
  const hasSendHistory =
    hasSendHistoryRaw === "true" ? true : hasSendHistoryRaw === "false" ? false : undefined;
  const rows = await listQuotes({ status, source, phone, needsReview, hasSendHistory });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
      <form className="mt-4 flex flex-wrap gap-2 text-sm" method="GET">
        <select name="status" defaultValue={status ?? ""} className="rounded border px-2 py-1">
          <option value="">status 전체</option>
          <option value="draft">draft</option>
          <option value="ready">ready</option>
          <option value="sent">sent</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
          <option value="expired">expired</option>
        </select>
        <select name="source" defaultValue={source ?? ""} className="rounded border px-2 py-1">
          <option value="">source 전체</option>
          <option value="auto">auto</option>
          <option value="manual">manual</option>
          <option value="imported">imported</option>
        </select>
        <select
          name="needs_review"
          defaultValue={needsReviewRaw ?? ""}
          className="rounded border px-2 py-1"
        >
          <option value="">review 전체</option>
          <option value="true">needs_review=true</option>
          <option value="false">needs_review=false</option>
        </select>
        <input
          name="phone"
          defaultValue={phone ?? ""}
          placeholder="phone 검색"
          className="rounded border px-2 py-1"
        />
        <select
          name="has_send_history"
          defaultValue={hasSendHistoryRaw ?? ""}
          className="rounded border px-2 py-1"
        >
          <option value="">발송이력 전체</option>
          <option value="true">발송이력 있음</option>
          <option value="false">발송이력 없음</option>
        </select>
        <button type="submit" className="rounded border px-3 py-1">
          필터
        </button>
        <Link href="/quotes/review" className="rounded border px-3 py-1">
          review 화면
        </Link>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3">status</th>
              <th className="py-2 pr-3">phone</th>
              <th className="py-2 pr-3">amount</th>
              <th className="py-2 pr-3">source</th>
              <th className="py-2 pr-3">sent</th>
              <th className="py-2 pr-3">updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="border-b">
                <td className="py-2 pr-3">
                  <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:underline">
                    {q.status}
                  </Link>
                </td>
                <td className="py-2 pr-3 font-mono">{q.customer_phone ?? "—"}</td>
                <td className="py-2 pr-3">{q.final_amount ?? q.total_amount ?? "—"}</td>
                <td className="py-2 pr-3">{q.source}</td>
                <td className="py-2 pr-3">{q.sent_at ? "Y" : "—"}</td>
                <td className="py-2 pr-3 text-xs">{new Date(q.updated_at).toISOString().slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

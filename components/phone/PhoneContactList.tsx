import type { PhoneContactRow } from "@/lib/types/database";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function PhoneContactList(props: {
  rows: PhoneContactRow[];
  total: number;
}) {
  const { rows, total } = props;
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        총 {total}건
      </p>
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-4">번호</th>
            <th className="py-2 pr-4">이름</th>
            <th className="py-2 pr-4">총 통화</th>
            <th className="py-2 pr-4">in / out</th>
            <th className="py-2 pr-4">last_intent</th>
            <th className="py-2 pr-4">last_summary</th>
            <th className="py-2 pr-4">last_seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 pr-4 align-top whitespace-nowrap">
                {r.phone_number}
              </td>
              <td className="py-2 pr-4 align-top">{r.name ?? "—"}</td>
              <td className="py-2 pr-4 align-top">{r.total_calls ?? 0}</td>
              <td className="py-2 pr-4 align-top">
                {r.inbound_calls ?? 0} / {r.outbound_calls ?? 0}
              </td>
              <td className="py-2 pr-4 align-top">{r.last_intent ?? "—"}</td>
              <td className="py-2 pr-4 align-top max-w-xs truncate" title={r.last_summary ?? ""}>
                {r.last_summary ?? "—"}
              </td>
              <td className="py-2 pr-4 align-top whitespace-nowrap">
                {fmtTime(r.last_seen_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">연락처가 없습니다.</p>
      ) : null}
    </div>
  );
}

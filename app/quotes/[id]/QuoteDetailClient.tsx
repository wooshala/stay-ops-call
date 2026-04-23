"use client";

import { useEffect, useState } from "react";

type QuoteDetailResponse = {
  ok: boolean;
  quote: {
    id: string;
    status: string;
    customer_phone: string | null;
    customer_name: string | null;
    quote_text: string | null;
    final_amount: number | null;
    internal_memo: string | null;
  };
  messages: Array<{
    id: string;
    send_status: string;
    provider: string | null;
    error_message: string | null;
    sent_at: string | null;
    created_at: string;
  }>;
  versions: Array<{
    id: string;
    version_no: number;
    draft_text: string;
    created_by: string | null;
    created_at: string;
  }>;
};

export function QuoteDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<QuoteDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${id}`, { cache: "no-store" });
      const json = (await res.json()) as QuoteDetailResponse | { error?: string };
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "load failed");
      setData(json as QuoteDetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const patchQuote = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "patch failed");
      }
      setActionMsg("저장 완료");
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const postStatus = async (status: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "status update failed");
      setActionMsg(`상태 변경: ${status}`);
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "상태 변경 실패");
    } finally {
      setSaving(false);
    }
  };

  const sendQuote = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok && !("sent" in j)) throw new Error(j.error ?? "send failed");
      setActionMsg(res.ok ? "발송 성공" : "발송 실패(리뷰 필요)");
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "발송 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm">로딩 중...</p>;
  if (error || !data) return <p className="text-sm text-rose-600">{error ?? "데이터 없음"}</p>;

  const q = data.quote;
  return (
    <div className="space-y-6">
      <section className="rounded border p-4">
        <p className="text-sm">status: {q.status}</p>
        <p className="text-sm font-mono">phone: {q.customer_phone ?? "—"}</p>
        <div className="mt-3 grid gap-2">
          <input
            defaultValue={q.customer_name ?? ""}
            placeholder="customer_name"
            className="rounded border px-2 py-1 text-sm"
            onBlur={(e) => void patchQuote({ customer_name: e.target.value || null })}
          />
          <input
            defaultValue={q.final_amount ?? ""}
            placeholder="final_amount"
            className="rounded border px-2 py-1 text-sm"
            onBlur={(e) =>
              void patchQuote({
                final_amount: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
          <textarea
            defaultValue={q.quote_text ?? ""}
            className="min-h-36 rounded border px-2 py-1 text-sm"
            onBlur={(e) => void patchQuote({ quote_text: e.target.value })}
          />
          <textarea
            defaultValue={q.internal_memo ?? ""}
            placeholder="internal_memo"
            className="min-h-20 rounded border px-2 py-1 text-sm"
            onBlur={(e) => void patchQuote({ internal_memo: e.target.value || null })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button disabled={saving} className="rounded border px-2 py-1" onClick={() => void postStatus("ready")}>
            ready로 변경
          </button>
          <button disabled={saving} className="rounded border px-2 py-1" onClick={() => void sendQuote()}>
            send
          </button>
          <button disabled={saving} className="rounded border px-2 py-1" onClick={() => void postStatus("accepted")}>
            accepted
          </button>
          <button disabled={saving} className="rounded border px-2 py-1" onClick={() => void postStatus("rejected")}>
            rejected
          </button>
        </div>
        {actionMsg ? <p className="mt-2 text-xs text-zinc-600">{actionMsg}</p> : null}
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold">발송 로그</h2>
        <ul className="space-y-1 text-xs">
          {data.messages.map((m) => (
            <li key={m.id}>
              [{m.send_status}] {m.provider ?? "provider"} / {m.error_message ?? "ok"} /{" "}
              {(m.sent_at ?? m.created_at).slice(0, 19)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-2 text-sm font-semibold">수정 이력</h2>
        <ul className="space-y-1 text-xs">
          {data.versions.map((v) => (
            <li key={v.id}>
              v{v.version_no} / {v.created_by ?? "unknown"} / {v.created_at.slice(0, 19)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

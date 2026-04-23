import Link from "next/link";

import { QuoteDetailClient } from "./QuoteDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function QuoteDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <Link href="/quotes" className="text-sm text-blue-600 hover:underline">
          ← quotes 목록
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Quote Detail</h1>
      <div className="mt-6">
        <QuoteDetailClient id={id} />
      </div>
    </main>
  );
}

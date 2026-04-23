import Link from "next/link";

import { QuoteDraftDetailClient } from "./QuoteDraftDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `견적 초안 ${id.slice(0, 8)}… · Stay-Ops-Call`,
  };
}

export default async function QuoteDraftDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/calls" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← 통화 목록
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">견적 초안 상세</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        통화 데이터를 기반으로 자동 생성된 견적 초안을 확인하고 수정합니다.
      </p>
      <div className="mt-6">
        <QuoteDraftDetailClient id={id} />
      </div>
    </main>
  );
}

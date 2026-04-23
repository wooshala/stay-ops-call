import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Stay-Ops-Call</h1>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        숙박 운영 통화 녹음을 STT·분류·엔티티·추천 액션으로 정리하는 MVP입니다.
        자동 예약 확정/문자 발송은 범위 밖이며, 기록·분류·추천에 집중합니다.
      </p>
      <ul className="flex flex-wrap gap-3 text-sm">
        <li>
          <Link
            className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            href="/upload"
          >
            통화 업로드
          </Link>
        </li>
        <li>
          <Link
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            href="/calls"
          >
            통화 목록
          </Link>
        </li>
        <li>
          <Link
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            href="/quotes"
          >
            견적(최종)
          </Link>
        </li>
        <li>
          <Link
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            href="/quote-drafts"
          >
            견적 초안
          </Link>
        </li>
        <li>
          <Link
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            href="/phone-contacts"
          >
            전화번호 DB
          </Link>
        </li>
        <li>
          <Link
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
            href="/batch-test"
          >
            배치 테스트
          </Link>
        </li>
      </ul>
    </main>
  );
}

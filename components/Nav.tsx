import Link from "next/link";

const links = [
  { href: "/upload", label: "업로드" },
  { href: "/calls", label: "통화 목록" },
  { href: "/approvals", label: "예약 승인" },
  { href: "/reservations", label: "수동 예약" },
  { href: "/ops/queue", label: "운영 큐" },
  { href: "/quotes", label: "견적(최종)" },
  { href: "/quote-drafts", label: "견적 초안" },
  { href: "/phone-contacts", label: "전화번호 DB" },
  { href: "/batch-test", label: "배치 테스트" },
  { href: "/file-review", label: "파일 검수" },
];

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Stay-Ops-Call
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

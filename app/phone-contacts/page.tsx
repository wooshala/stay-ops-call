import { PhoneContactList } from "@/components/phone/PhoneContactList";
import { listPhoneContacts } from "@/lib/db/calls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전화번호 DB · Stay-Ops-Call",
};

export default async function PhoneContactsPage() {
  const { rows, total } = await listPhoneContacts({ page: 1, pageSize: 100 });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">전화번호 DB</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        외부·스마트콜 라인에서 누적된 번호입니다. 업로드 시점에 카운트가
        갱신되고, 분석 후 마지막 의도·요약이 갱신됩니다.
      </p>
      <div className="mt-8">
        <PhoneContactList rows={rows} total={total} />
      </div>
    </main>
  );
}

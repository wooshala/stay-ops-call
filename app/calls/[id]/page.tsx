import Link from "next/link";
import { notFound } from "next/navigation";

import { CallDetail } from "@/components/calls/CallDetail";
import { getBatchJobIdForCall, getCallDetailBundle } from "@/lib/db/calls";
import { listReviewJobs, listReviewLinksForCall } from "@/lib/db/review";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `통화 ${id.slice(0, 8)}… · Stay-Ops-Call` };
}

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;
  const bundle = await getCallDetailBundle(id);
  if (!bundle) notFound();

  const [batchJobId, reviewLinks, reviewJobs] = await Promise.all([
    getBatchJobIdForCall(id),
    listReviewLinksForCall(id).catch((e) => {
      console.warn("[calls/[id]] listReviewLinksForCall", e);
      return [] as Awaited<ReturnType<typeof listReviewLinksForCall>>;
    }),
    listReviewJobs(80).catch((e) => {
      console.warn("[calls/[id]] listReviewJobs", e);
      return [] as Awaited<ReturnType<typeof listReviewJobs>>;
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/calls"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← 목록
          </Link>
          <Link
            href={`/quote-drafts/${id}`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            견적 초안 열기
          </Link>
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">통화 상세</h1>
      <div className="mt-8">
        <CallDetail
          call={bundle.call}
          entities={bundle.entities}
          recommendations={bundle.recommendations}
          operation_case={bundle.operation_case}
          service_request={bundle.service_request}
          reservation_lead={bundle.reservation_lead}
          batchJobId={batchJobId}
          reviewLinks={reviewLinks}
          reviewJobs={reviewJobs}
        />
      </div>
    </main>
  );
}

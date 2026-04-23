import ReviewPipelineBoard from "@/components/review/ReviewPipelineBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "파일 검수 · Stay-Ops-Call",
};

export default function FileReviewPage() {
  return <ReviewPipelineBoard />;
}

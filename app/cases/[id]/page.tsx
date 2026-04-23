import CaseDetail from "@/features/case/components/CaseDetail";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetail caseId={id} />;
}


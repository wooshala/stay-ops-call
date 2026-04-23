import { computeCaseRisk } from "@/features/case/lib/risk";
import { getCaseById, listCaseEvents } from "@/features/case/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await getCaseById(id);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  const events = await listCaseEvents(id);
  return Response.json({ row: { ...row, ...computeCaseRisk(row) }, events });
}


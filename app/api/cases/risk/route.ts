import { computeCaseRisk } from "@/features/case/lib/risk";
import { listCases } from "@/features/case/db";

export async function GET() {
  const rows = await listCases({});
  const enriched = rows.map((r) => ({ ...r, ...computeCaseRisk(r) }));

  const risky = enriched.filter((r) => r.risk_level !== "normal" || r.is_overdue);
  return Response.json({ rows: risky });
}


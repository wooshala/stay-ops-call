import { computeCaseRisk } from "@/features/case/lib/risk";
import { listCases } from "@/features/case/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state") ?? undefined;
  const owner = searchParams.get("owner") ?? undefined;
  const riskLevel = searchParams.get("risk_level") ?? undefined;

  const rows = await listCases({ state, owner });
  const enriched = rows.map((r) => {
    const risk = computeCaseRisk(r);
    return { ...r, ...risk };
  });

  const filtered =
    riskLevel && riskLevel !== "all"
      ? enriched.filter((r) => r.risk_level === riskLevel)
      : enriched;

  return Response.json({ rows: filtered });
}


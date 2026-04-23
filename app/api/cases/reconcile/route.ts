import { reconcileCasesFromCalls } from "@/features/case/service/reconcile";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = typeof body.limit === "number" ? body.limit : undefined;
  const result = await reconcileCasesFromCalls({ limit });
  return Response.json({ ok: true, result });
}


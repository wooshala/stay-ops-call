import { assertInternalApiAuthorized } from "@/lib/auth/internalApi";
import { listOpsQueueItems } from "@/lib/db/opsQueue";
import type { OpsQueueType } from "@/lib/types/opsQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<OpsQueueType>(["failed", "review", "retry"]);

export async function GET(request: Request): Promise<Response> {
  const denied = assertInternalApiAuthorized(request, "GET /api/ops/queue");
  if (denied) {
    console.warn("[api][ops-queue][auth] rejected");
    return denied;
  }

  const url = new URL(request.url);
  const typeRaw = url.searchParams.get("type")?.trim() as OpsQueueType | undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, limitRaw ? Number(limitRaw) || 50 : 50),
  );

  if (!typeRaw || !ALLOWED_TYPES.has(typeRaw)) {
    console.warn("[api][ops-queue] invalid type", { type: typeRaw });
    return Response.json(
      { error: "Invalid type; use failed | review | retry" },
      { status: 400 },
    );
  }

  const type = typeRaw;

  try {
    const { items, count } = await listOpsQueueItems(type, limit);
    console.log("[api][ops-queue] ok", { type, count, rows: items.length });

    return Response.json({
      items,
      count,
      type,
    });
  } catch (e) {
    console.error("[api][ops-queue] unexpected", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

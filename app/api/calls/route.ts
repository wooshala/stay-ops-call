import { getBatchStatsFromDB } from "@/lib/db/batchCallStats";
import { listCallsDashboard } from "@/lib/db/callDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_BATCH = {
  rows: [] as unknown[],
  stats: {
    total: 0,
    failed: 0,
    success: 0,
    queued: 0,
    label_ready: 0,
  },
  failureTop: [] as unknown[],
};

function tri(v: string | null): "yes" | "no" | null {
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const batchId = url.searchParams.get("batch_id")?.trim();
    if (batchId) {
      try {
        const { rows, stats, failureTop } = await getBatchStatsFromDB(batchId);
        return Response.json({
          rows,
          stats,
          failureTop,
          total: stats.total,
        });
      } catch (e) {
        console.error("[GET /api/calls] batch_id", e);
        return Response.json(EMPTY_BATCH);
      }
    }

    const intent = url.searchParams.get("intent");
    const phone = url.searchParams.get("phone");
    const room_hint =
      url.searchParams.get("room_hint") ?? url.searchParams.get("room_no");
    const room_no_present = tri(url.searchParams.get("room_no_present"));
    const workflow_created = tri(url.searchParams.get("workflow_created"));
    const has_error = tri(url.searchParams.get("has_error"));
    const handling_status = url.searchParams.get("handling_status") || null;
    const pending_only = url.searchParams.get("pending_only") === "1";
    const assignee = url.searchParams.get("assignee") || null;
    const page = url.searchParams.get("page");
    const pageSize = url.searchParams.get("pageSize");

    const { rows, total, summary } = await listCallsDashboard({
      intent,
      phone,
      room_hint,
      room_no_present,
      workflow_created,
      has_error,
      handling_status: handling_status as Parameters<typeof listCallsDashboard>[0]["handling_status"],
      pending_only,
      assignee,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });

    return Response.json({
      calls: rows,
      total,
      summary,
      page: Number(page) || 1,
    });
  } catch (e) {
    console.error("[GET /api/calls]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "List failed" },
      { status: 500 },
    );
  }
}

import { getServiceSupabase } from "@/lib/supabase/server";
import type { OpsQueueItem, OpsQueueType } from "@/lib/types/opsQueue";

const ALLOWED_TYPES = new Set<OpsQueueType>(["failed", "review", "retry"]);

export async function listOpsQueueItems(
  type: OpsQueueType,
  limit = 50,
): Promise<{ items: OpsQueueItem[]; count: number; type: OpsQueueType }> {
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Invalid ops queue type");
  }

  const supabase = getServiceSupabase();
  let q = supabase
    .from("calls")
    .select(
      "id, source_file_name, primary_intent, summary, analysis_status, workflow_status, workflow_error_code, workflow_error_message, analysis_confidence, created_at, updated_at",
      { count: "exact" },
    );

  if (type === "failed") {
    q = q.eq("workflow_status", "failed");
  } else if (type === "review") {
    q = q.lt("analysis_confidence", 0.7);
  } else {
    q = q.eq("analysis_status", "queued");
  }

  const safeLimit = Math.min(100, Math.max(1, limit));
  const { data, error, count } = await q
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message ?? "Query failed");
  }

  const items = (data ?? []) as OpsQueueItem[];
  return {
    items,
    count: count ?? items.length,
    type,
  };
}

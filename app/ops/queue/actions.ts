"use server";

import { listOpsQueueItems } from "@/lib/db/opsQueue";
import type { OpsQueueItem, OpsQueueType } from "@/lib/types/opsQueue";

export async function loadOpsQueue(
  type: OpsQueueType,
  limit = 50,
): Promise<{ items: OpsQueueItem[]; count: number; type: OpsQueueType }> {
  return listOpsQueueItems(type, limit);
}

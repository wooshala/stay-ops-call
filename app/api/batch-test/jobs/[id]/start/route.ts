import { after } from "next/server";

import { runBatchJobWorker } from "@/lib/batch-test/runBatchJobWorker";
import { getBatchJob, tryStartBatchJob, listBatchJobItems, linkBatchJobItemToCall } from "@/lib/db/batchJobs";
import { createCallForBatch } from "@/lib/db/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const job = await getBatchJob(id);
  if (!job) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await tryStartBatchJob(id);
  if (!result.started) {
    return Response.json({
      ok: true,
      accepted: false,
      reason: result.reason,
    });
  }

  after(async () => {
    try {
      // Create call records from batch_job_items
      const items = await listBatchJobItems(id);
      for (const item of items) {
        try {
          const call = await createCallForBatch({
            batch_job_id: id,
            source_file_name: item.file_name,
          });
          // Link the batch_job_item to the created call
          await linkBatchJobItemToCall(item.id, call.id);
          console.log(`[batch-test] created call ${call.id} for ${item.file_name}`);
        } catch (e) {
          console.error(`[batch-test] failed to create call for ${item.file_name}:`, e);
        }
      }

      // Now run the batch worker
      void runBatchJobWorker(id).catch((e) => {
        console.error("[batch-test] runBatchJobWorker", e);
      });
    } catch (e) {
      console.error("[batch-test] batch setup error", e);
    }
  });

  return Response.json({ ok: true, accepted: true });
}

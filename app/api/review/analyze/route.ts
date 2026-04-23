import { after } from "next/server";
import fs from "fs/promises";
import path from "path";

import { safeResolveFixturePath } from "@/lib/batch-test/fixturesPath";
import { runBatchJobWorker } from "@/lib/batch-test/runBatchJobWorker";
import { createBatchJob, tryStartBatchJob } from "@/lib/db/batchJobs";
import {
  createReviewCall,
  findCallByFingerprint,
  insertReviewLog,
  markCallQueuedForAnalyze,
} from "@/lib/db/reviewPipeline";
import { buildFallbackFingerprint, buildFileFingerprint } from "@/lib/review/fingerprint";
import { getReviewCallsUploadDir } from "@/lib/review/uploadsPath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      files?: string[];
      reviewed_by?: string;
    };
    const names = Array.isArray(body.files)
      ? body.files.map((s) => String(s).trim()).filter(Boolean)
      : [];

    if (names.length === 0) {
      return Response.json({ error: "Body: { files: string[] }" }, { status: 400 });
    }

    const uploadDir = getReviewCallsUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const batch = await createBatchJob({
      pipeline: "full",
      total_count: names.length,
      name: "파일검수",
      uploadRoot: path.resolve(uploadDir),
    });

    let reused = 0;
    let created = 0;

    for (const name of names) {
      const abs = safeResolveFixturePath(uploadDir, name);
      if (!abs) {
        continue;
      }
      let st;
      try {
        st = await fs.stat(abs);
      } catch {
        continue;
      }
      let fp = "";
      try {
        fp = buildFileFingerprint({ name, bytes: st.size, mtime: st.mtime.toISOString() });
      } catch {
        fp = buildFallbackFingerprint({ name, bytes: st.size });
      }

      const found = await findCallByFingerprint(fp);
      if (found?.id) {
        reused += 1;
        await markCallQueuedForAnalyze(found.id, batch.id, Math.ceil(st.size / 1024));
        await insertReviewLog({
          call_id: found.id,
          action: "reanalyze_requested",
          before_json: { review_status: found.review_status, label_status: found.label_status },
          after_json: { batch_job_id: batch.id, analysis_status: "queued" },
          created_by: body.reviewed_by?.trim() || "system",
        });
        continue;
      }

      await createReviewCall({
        source_file_name: name,
        file_fingerprint: fp,
        file_size_kb: Math.ceil(st.size / 1024),
        batch_job_id: batch.id,
      });
      created += 1;
    }

    const start = await tryStartBatchJob(batch.id);
    if (start.started) {
      after(() => {
        void runBatchJobWorker(batch.id).catch((err) => {
          console.error("[review/analyze] worker", err);
        });
      });
    }

    return Response.json({
      ok: true,
      job_id: batch.id,
      accepted: start.started,
      created_count: created,
      reused_count: reused,
      selected_count: names.length,
    });
  } catch (e) {
    console.error("[review/analyze]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

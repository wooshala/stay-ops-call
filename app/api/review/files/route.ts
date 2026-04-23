import fs from "fs/promises";

import { listUploadAudioFiles } from "@/lib/review/listUploadFiles";
import { getReviewCallsUploadDir } from "@/lib/review/uploadsPath";
import { buildFallbackFingerprint, buildFileFingerprint } from "@/lib/review/fingerprint";
import {
  findCallByFingerprint,
  getReviewSchemaFlags,
  type ReviewPipelineRow,
} from "@/lib/db/reviewPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = getReviewCallsUploadDir();
    await fs.mkdir(dir, { recursive: true });

    const flags = await getReviewSchemaFlags();
    const files = await listUploadAudioFiles(dir);

    const rows: Array<{
      name: string;
      bytes: number;
      mtime: string;
      durationSec: number | null;
      fingerprint: string;
      fingerprint_fallback_used: boolean;
      call: ReviewPipelineRow | null;
    }> = [];

    for (const f of files) {
      let fallbackUsed = false;
      let fp = "";
      try {
        fp = buildFileFingerprint({ name: f.name, bytes: f.bytes, mtime: f.mtime });
      } catch {
        fallbackUsed = true;
        fp = buildFallbackFingerprint({ name: f.name, bytes: f.bytes });
      }

      const call = flags.fingerprint ? await findCallByFingerprint(fp) : null;
      rows.push({
        ...f,
        fingerprint: fp,
        fingerprint_fallback_used: fallbackUsed,
        call,
      });
    }

    return Response.json({
      uploadDir: dir,
      flags,
      warning: !flags.sourceFileName
        ? "migration 필요: calls.source_file_name"
        : null,
      files: rows,
    });
  } catch (e) {
    console.error("[review/files]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

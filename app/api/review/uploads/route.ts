import fs from "fs/promises";

import { listUploadAudioFiles } from "@/lib/review/listUploadFiles";
import { getReviewCallsUploadDir } from "@/lib/review/uploadsPath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = getReviewCallsUploadDir();
    await fs.mkdir(dir, { recursive: true });
    const files = await listUploadAudioFiles(dir);
    return Response.json({
      uploadDir: dir,
      files,
    });
  } catch (e) {
    console.error("[review/uploads]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

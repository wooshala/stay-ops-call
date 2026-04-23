import fs from "fs/promises";
import path from "path";

import { guessContentType } from "@/lib/batch-test/fixturesPath";

const AUDIO_EXT = /\.(mp3|wav|m4a|webm|ogg|flac|aac|mp4)$/i;

export type UploadFileRow = {
  name: string;
  bytes: number;
  /** ISO */
  mtime: string;
  /** 가능하면 채움 — 현재는 미구현(null) */
  durationSec: number | null;
};

export async function listUploadAudioFiles(
  dir: string,
): Promise<UploadFileRow[]> {
  try {
    const names = await fs.readdir(dir);
    const out: UploadFileRow[] = [];
    for (const n of names) {
      if (!AUDIO_EXT.test(n)) continue;
      const p = path.join(dir, n);
      const st = await fs.stat(p);
      if (!st.isFile()) continue;
      out.push({
        name: n,
        bytes: st.size,
        mtime: st.mtime.toISOString(),
        durationSec: null,
      });
    }
    out.sort((a, b) => b.mtime.localeCompare(a.mtime));
    return out;
  } catch {
    return [];
  }
}

export { guessContentType };

import fs from "fs/promises";
import path from "path";

const AUDIO_EXT = /\.(mp3|wav|m4a|webm|ogg|flac|aac|mp4)$/i;

export function getBatchTestFixturesDir(): string {
  const env = process.env.BATCH_TEST_FIXTURES_DIR?.trim();
  if (env) {
    return path.isAbsolute(env)
      ? env
      : path.join(/* turbopackIgnore: true */ process.cwd(), env);
  }
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "batch-test",
    "fixtures",
  );
}

/** `name` must be a single path segment (filename only). */
export function safeResolveFixturePath(
  fixturesDir: string,
  name: string,
): string | null {
  const base = path.basename(name);
  if (!base || base !== name || base === "." || base === "..") {
    return null;
  }
  const full = path.join(fixturesDir, base);
  const resolvedFixtures = path.resolve(fixturesDir);
  const resolvedFull = path.resolve(full);
  const rel = path.relative(resolvedFixtures, resolvedFull);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return resolvedFull;
}

export async function listFixtureAudioFiles(fixturesDir: string): Promise<
  Array<{ name: string; bytes: number }>
> {
  try {
    const names = await fs.readdir(fixturesDir);
    const out: Array<{ name: string; bytes: number }> = [];
    for (const n of names) {
      if (!AUDIO_EXT.test(n)) continue;
      const p = path.join(fixturesDir, n);
      const st = await fs.stat(p);
      if (st.isFile()) {
        out.push({ name: n, bytes: st.size });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  } catch {
    return [];
  }
}

export function guessContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
  };
  return map[ext] ?? "application/octet-stream";
}

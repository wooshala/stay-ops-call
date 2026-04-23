import fs from "fs/promises";

import {
  guessContentType,
  safeResolveFixturePath,
} from "@/lib/batch-test/fixturesPath";
import { getReviewCallsUploadDir } from "@/lib/review/uploadsPath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    if (!name) {
      return Response.json({ error: "name required" }, { status: 400 });
    }
    const dir = getReviewCallsUploadDir();
    const abs = safeResolveFixturePath(dir, name);
    if (!abs) {
      return Response.json({ error: "invalid name" }, { status: 400 });
    }
    const buf = await fs.readFile(abs);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": guessContentType(name),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("[review/file]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

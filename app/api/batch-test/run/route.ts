import { insertBatchJob } from "@/lib/db/batchJobs";
import type { BatchPipelineMode } from "@/lib/batch-test/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 500;

const PIPELINES: BatchPipelineMode[] = ["stt", "stt_analysis", "full"];

function parsePipeline(raw: unknown): BatchPipelineMode {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (PIPELINES.includes(s as BatchPipelineMode)) {
    return s as BatchPipelineMode;
  }
  return "full";
}

function parseLimit(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(Math.floor(n), MAX_BATCH);
}

/**
 * 배치 job만 생성하고 즉시 반환. 실제 처리는 POST .../jobs/[id]/start + 워커.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const files = (body as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0) {
    return Response.json(
      { error: 'Body must be { "files": string[] } with at least one filename' },
      { status: 400 },
    );
  }

  const pipeline = parsePipeline((body as { pipeline?: unknown }).pipeline);
  const limit = parseLimit((body as { limit?: unknown }).limit);

  const allNames = files.map((f) => String(f).trim()).filter(Boolean);
  if (allNames.length === 0) {
    return Response.json({ error: "No valid filenames" }, { status: 400 });
  }

  const cap = limit != null ? Math.min(limit, MAX_BATCH) : MAX_BATCH;
  const truncated = allNames.length > cap;
  const names = allNames.slice(0, cap);

  const bodyName = (body as { name?: unknown }).name;
  const jobName =
    typeof bodyName === "string" && bodyName.trim()
      ? bodyName.trim()
      : `배치 ${pipeline} · ${names.length}건`;

  const { job } = await insertBatchJob({
    pipeline,
    fileNames: names,
    name: jobName,
  });

  return Response.json({
    ok: true,
    job_id: job.id,
    total_count: job.total_count,
    meta: {
      pipeline,
      limitRequested: limit,
      cap,
      truncated,
      requestedFileCount: allNames.length,
    },
  });
}

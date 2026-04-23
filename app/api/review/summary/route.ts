import { listExcludedFileNames } from "@/lib/db/reviewFileState";
import { listUploadAudioFiles } from "@/lib/review/listUploadFiles";
import { getReviewCallsUploadDir } from "@/lib/review/uploadsPath";
import { isMissingColumnOrRelationError } from "@/lib/supabase/columnError";
import { getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dir = getReviewCallsUploadDir();
    const diskFiles = await listUploadAudioFiles(dir);
    const excluded = await listExcludedFileNames();

    const supabase = getServiceSupabase();
    const { data: calls, error } = await supabase
      .from("calls")
      .select("id, source_file_name, created_at, analysis_status")
      .not("source_file_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error && isMissingColumnOrRelationError(error)) {
      console.warn(
        "[review/summary] calls.source_file_name 없음 — 폴백(분석 완료 목록 비움)",
        error.message,
      );
      const excludedList = diskFiles.filter((f) => excluded.has(f.name));
      const unprocessed = diskFiles.filter((f) => !excluded.has(f.name));
      return Response.json({
        uploadDir: dir,
        analyzed: [] as Array<{
          id: string;
          source_file_name: string | null;
          created_at: string;
          analysis_status: string | null;
        }>,
        unprocessed,
        excluded: excludedList,
        degraded: true as const,
      });
    }
    if (error) throw error;

    const analyzedNames = new Set(
      (calls ?? [])
        .map((c) => (c as { source_file_name: string | null }).source_file_name)
        .filter((x): x is string => x != null && x !== ""),
    );

    const analyzed = (calls ?? []) as Array<{
      id: string;
      source_file_name: string | null;
      created_at: string;
      analysis_status: string | null;
    }>;

    const unprocessed = diskFiles.filter(
      (f) => !analyzedNames.has(f.name) && !excluded.has(f.name),
    );
    const excludedList = diskFiles.filter((f) => excluded.has(f.name));

    return Response.json({
      uploadDir: dir,
      analyzed,
      unprocessed,
      excluded: excludedList,
    });
  } catch (e) {
    console.error("[review/summary]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

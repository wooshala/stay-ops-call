import { getServiceSupabase } from "@/lib/supabase/server";

export async function listExcludedFileNames(): Promise<Set<string>> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("review_file_state")
    .select("file_name")
    .eq("excluded", true);
  if (error) {
    console.warn("[review_file_state] list", error);
    return new Set();
  }
  return new Set(
    (data ?? []).map((r) => (r as { file_name: string }).file_name),
  );
}

export async function setFileExcluded(
  fileName: string,
  excluded: boolean,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("review_file_state").upsert(
    {
      file_name: fileName,
      excluded,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "file_name" },
  );
  if (error) throw error;
}

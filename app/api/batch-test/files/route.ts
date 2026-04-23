import {
  getBatchTestFixturesDir,
  listFixtureAudioFiles,
} from "@/lib/batch-test/fixturesPath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const fixturesDir = getBatchTestFixturesDir();
  const files = await listFixtureAudioFiles(fixturesDir);
  return Response.json({
    fixturesDir,
    files,
  });
}

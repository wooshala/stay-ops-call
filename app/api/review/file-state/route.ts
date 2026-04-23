import { listExcludedFileNames, setFileExcluded } from "@/lib/db/reviewFileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const excluded = await listExcludedFileNames();
    return Response.json({ excluded: [...excluded] });
  } catch (e) {
    console.error("[review/file-state GET]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: string;
      excluded?: boolean;
    };
    const fileName = body.fileName?.trim();
    if (!fileName) {
      return Response.json({ error: "fileName required" }, { status: 400 });
    }
    await setFileExcluded(fileName, body.excluded === true);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[review/file-state POST]", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}

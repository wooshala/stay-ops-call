export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  console.warn("[DEPRECATED] /api/review/run is retired. Use POST /api/review/analyze");
  return Response.json(
    {
      error: "deprecated_endpoint",
      message: "Use POST /api/review/analyze",
      replacement: "/api/review/analyze",
    },
    { status: 410 },
  );
}

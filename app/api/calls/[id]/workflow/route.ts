import { assertInternalApiAuthorized } from "@/lib/auth/internalApi";
import { executeCallWorkflowOnly } from "@/lib/api/callWorkflowTrigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = assertInternalApiAuthorized(request, "POST /api/calls/[id]/workflow");
  if (denied) {
    console.warn("[api][calls][workflow][auth] rejected");
    return denied;
  }

  const { id } = await ctx.params;
  const wf = await executeCallWorkflowOnly(id);
  return Response.json({ workflow: wf });
}

import { getBearerTokenFromRequest } from "@/lib/auth/internalApi";

/** Reprocess: INTERNAL_API_TOKEN or INTERNAL_EVENTS_SECRET (ops recovery). */
export function assertReprocessAuthorized(request: Request): Response | null {
  const bearer = getBearerTokenFromRequest(request);

  const apiToken = process.env.INTERNAL_API_TOKEN?.trim();
  if (apiToken && bearer === apiToken) return null;

  const eventsSecret =
    process.env.INTERNAL_EVENTS_SECRET?.trim() ??
    process.env.UNIVER_OPS_SECRET?.trim();
  if (eventsSecret && bearer === eventsSecret) return null;

  if (process.env.NODE_ENV !== "production") {
    if (!apiToken && !eventsSecret) return null;
  }

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

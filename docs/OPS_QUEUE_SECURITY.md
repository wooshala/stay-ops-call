# Ops / internal HTTP API security

## Protected routes

These HTTP handlers require internal authentication when `INTERNAL_API_TOKEN` is set (non-empty after trim):

| Method | Path |
|--------|------|
| `GET` | `/api/ops/queue` |
| `POST` | `/api/calls/[id]/analyze` |
| `POST` | `/api/calls/[id]/workflow` |

## Authentication

Send a static secret in the standard header:

```http
Authorization: Bearer <INTERNAL_API_TOKEN>
```

Configure on the server:

- `INTERNAL_API_TOKEN` — shared secret; **never** prefix with `NEXT_PUBLIC_` and **never** embed in client-side `fetch`.

Implementation: `lib/auth/internalApi.ts` (`getBearerTokenFromRequest`, `assertInternalApiAuthorized`). Failed checks return `401` with body `{ "error": "Unauthorized" }`.

## Development vs production

| Condition | Behavior |
|-----------|----------|
| `INTERNAL_API_TOKEN` **set** | Bearer must match exactly; wrong or missing header → `401`. Console: `[auth][internal-api] unauthorized …` |
| `INTERNAL_API_TOKEN` **unset** and `NODE_ENV === "production"` | **401** (fail closed). Console error: `[auth][internal-api] INTERNAL_API_TOKEN is required in production` |
| `INTERNAL_API_TOKEN` **unset** and **not** production | Request allowed (bypass). Console warning: `[auth][internal-api] INTERNAL_API_TOKEN missing; bypass enabled in development` |

## Ops UI and browser traffic

The `/ops/queue` UI loads queue data and triggers analyze/workflow via **Server Actions** (`app/ops/queue/actions.ts`, `app/calls/actions.ts`) so the browser never receives `INTERNAL_API_TOKEN`.

**Residual risk:** Server Actions are not protected by this Bearer scheme. Anyone who can POST to the Next.js app origin could invoke those actions unless you add session checks, network restrictions, or similar. Treat this as a **network / deployment boundary** concern for internal ops tools.

## Scripts and curl

When `INTERNAL_API_TOKEN` is set on the app, callers must send the same value (e.g. from shell env):

```bash
export INTERNAL_API_TOKEN='your-secret'

curl -sS -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  "http://localhost:3000/api/ops/queue?type=failed"

curl -sS -X POST \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "http://localhost:3000/api/calls/<CALL_ID>/analyze"

curl -sS -X POST \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "http://localhost:3000/api/calls/<CALL_ID>/workflow"
```

Repo scripts that call analyze (`reprocess-workflow.js`, `scripts/reprocess-all.js`) add `Authorization` when `INTERNAL_API_TOKEN` is present in the script process environment.

## Related code

- `proxy.ts` — defines `INTERNAL_API_KEY` / `x-api-key` for `/api/*`, but there is **no** `middleware.ts` wiring it; live traffic does not use that path unless you add middleware later.

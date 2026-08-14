---
name: studio-api
description: Add or change a Voice Studio API route, key kind, session capability or SDK surface. Use when working under src/app/api, on API keys, on the SSE streams, on the embeddable widget script, or on the JS and Swift SDKs, and when a route returns 401, 403 or CORS errors.
---

# API and SDK surfaces

## The three callers

| Caller | Credential | Reaches |
| --- | --- | --- |
| Operator in the browser | Clerk session -> `getAuth()` | `/api/internal/*` and every page |
| Client app, server side | `vs_sk_live_` -> `requireApiKey(req)` | `/api/v1/*`, any channel |
| Browser or widget | `vs_pk_live_` -> `requireApiKey(req)` | `/api/v1/*`, published agents only |
| A live session | `vst_` -> `resolveSessionToken(raw)` | its own session, `/api/media/complete` |

`/api/v1` is the public product surface and is versioned; breaking it breaks the
shipped SDKs and the widget. `/api/internal` is for our own pages and may change
freely.

## Writing a route

```ts
import { apiError, corsHeaders, json, readJson } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'

export const runtime = 'nodejs'                     // node:sqlite needs it

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request) {
  const key = requireApiKey(req)
  if (!key) return apiError('Unauthorized', 401)
  const body = await readJson<{ agentId?: string }>(req)
  if (!body.agentId) return apiError('agentId is required')
  // scope every read and write to key.tenant_id
  return json({ ok: true }, 200, corsHeaders(req))
}
```

Rules that are not optional:

- **Every public route exports `OPTIONS` and puts `corsHeaders(req)` on every
  response**, including errors. Omit it and the widget fails only in a browser, which
  a `curl` test will not show.
- **Scope by the credential's tenant**, never by a tenant id from the body.
- **A publishable key must not gain a server capability.** The `channel === 'api'`
  rejection and the unpublished-agent rejection in `src/app/api/v1/sessions/route.ts`
  are the pattern to copy. Widen that only with an explicit instruction.
- **Error text is plain ASCII, and names no model or provider.** No stack traces, no
  SQL, no key material in a response body.
- **Add the route to `src/proxy.ts` `PUBLIC` only if unauthenticated traffic must reach
  it**, and only when the handler authenticates itself. That array is the auth gate.

## SSE

Two streams exist and they differ:

- `/api/internal/live` - operator cookie, sends the whole tenant snapshot on every hub
  event. Feeds the monitor.
- `/api/v1/sessions/[sessionId]/events` - session token in the query string, sends that
  session's turns. Feeds the SDKs and the widget.

Both subscribe to the in-process hub in `src/lib/realtime/hub.ts`, and both must clear
their interval and unsubscribe on `req.signal` abort. A stream that leaks a subscriber
keeps a dead tenant fanning out forever. Headers: `text/event-stream`,
`Cache-Control: no-cache, no-transform`, and a `: ping` comment every 15 seconds.

State changes reach the monitor only through `publish()`, which the store functions
already call. Write through `src/lib/store/calls.ts`, never with raw SQL from a route,
or the monitor goes silent.

## Keys

Created in `src/lib/store/keys.ts`. Only the `sha256` hash is stored, so the secret is
shown once and is unrecoverable. Never log, print or commit a full key. When you touch
this file, check that `resolveApiKey` still rejects revoked keys and still stamps
`last_used_at`.

Tenant provider keys are a second, different thing, in `src/lib/store/credentials.ts`.
They are encrypted rather than hashed, because a turn has to present them again. Only
`useCredentialSecret` decrypts, and its result must never reach a response, a log line
or a view model.

## Choosing a model

Four levels, first one set wins: request (`model` on `/api/media/complete`), session
(`model` on `POST /api/v1/sessions`, or `PATCH /api/v1/sessions/[id]`), agent
(`PATCH /api/v1/agents/[id]`), then the platform key. `src/lib/models/route.ts` is the
only place that order lives.

Choosing spends the tenant's own provider key, so it is a **secret-key capability**.
`requireSecretKey(req)` guards every entry point, and a `vst_` session token is not
enough even though it is enough to speak a turn. The studio's own operator session
counts as privileged; the widget never does.

Validate a reference with `assertRoutable` at configuration time. A caller who finds
out mid-call that the key is missing is already speaking.

## SDKs

Three clients ship against `/api/v1` and drift silently, because nothing type-checks
them together:

- `public/sdk/voice-studio.js` - the browser script tag, plain JS, no build step
- `sdk/js/index.ts` - the TypeScript client
- `sdk/swift/Sources/VoiceStudio/VoiceStudioClient.swift` - the macOS client
- `src/components/widget/WidgetClient.tsx` - the in-app widget, same endpoints

Change a request or response shape and you update all four, or you state clearly which
you left. Turn audio stays on the device by design: the control plane never receives
audio, only text. Do not add an audio upload endpoint without saying that this reverses
the privacy and cost position in `docs/02-decisions.md`.

## Verify

```bash
# unauthorised, wrong key kind, happy path
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/v1/sessions
curl -s -X POST http://localhost:3000/api/v1/sessions -H "Authorization: Bearer $PK" \
  -H 'Content-Type: application/json' -d '{"agentId":"agt_...","channel":"api"}'
curl -s -i -X OPTIONS http://localhost:3000/api/v1/sessions -H 'Origin: https://example.com' | head -8
```

Then `pnpm typecheck` and `pnpm build`. Use the `studio-dev` skill for keys and ids.

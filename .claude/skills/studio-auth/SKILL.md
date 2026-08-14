---
name: studio-auth
description: Work on Voice Studio sign-in, sessions, the route gate, or the Clerk migration. Use when touching src/proxy.ts, src/lib/auth/*, the login and signup screens, tenant provisioning, who-is-signed-in on the server, or when a page unexpectedly redirects to login.
---

# Auth

Two credential systems, and they never mix:

| Who | Credential | Guarded by |
| --- | --- | --- |
| A human operator | browser session | `src/proxy.ts` plus the server helper on every page |
| Another program | `vs_sk_live_`, `vs_pk_live_`, `vst_` | the handler itself, via `requireApiKey` / `resolveSessionToken` |

**Clerk covers humans only.** It must never guard `/api/v1`, `/api/media`, `/widget` or
`/sdk`. Those are other people's software calling us with our keys, and Clerk has no
opinion about them.

## Invariants

Break any of these and the change is wrong, whatever the ticket says.

1. **No bypass, in any environment.** No `authBypass`, no `NODE_ENV` branch that skips
   the gate, no "dev only" auto sign-in. If verification gets harder, verification
   changes, not the gate.
2. **The gate lives on each resource.** `src/proxy.ts` runs `clerkMiddleware()` and
   decides nothing: Clerk deprecated `createRouteMatcher` because a path matcher can
   diverge from how Next routes a request. `requireAuth()` in the `(studio)` and `(ops)`
   layouts covers every operator surface, `getAuth()` covers `/api/internal/*`, and the
   public routes check their own credential. A new resource with no check is open, so
   name its check in the PR.
3. **Tenant scoping survives.** Every store call takes a tenant id from the resolved
   session, never from a request body, a query string or a header.
4. **One session concept per caller.** A human never authenticates with an API key, and
   a program never carries a browser session.

## How it works now

- `src/proxy.ts` is `clerkMiddleware()` and nothing else.
- `src/lib/auth/session.ts` turns a Clerk user id into the same `AuthContext` the app
  always consumed, so no page, layout or view model changed. `users` is a local mirror
  keyed by the Clerk user id, which keeps `tenants.owner_id` and `tenant_members.user_id`
  valid.
- First signed-in request provisions the workspace in one transaction: mirror row,
  tenant, owner membership. No onboarding step.
- `<SignIn />` and `<SignUp />` are mounted at `/login/[[...rest]]` and
  `/signup/[[...rest]]`, so existing links and redirects still work. The catch-all is
  required: Clerk routes its own sub-steps under those paths.
- `dead password path removed`: no scrypt, no `sessions` table, no `vs_session` cookie.
  `sha256` moved to `src/lib/db/hash.ts`, where the API key and `vst_` token hashing
  lives.

### Keys and keyless mode

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` belong in `.env.local` and in
`vercel env`. With neither set, Clerk 7 runs a temporary keyless development instance and
writes scratch keys into `.clerk/`, which is git-ignored: sign-in works locally, and the
console prints a claim link. Treat that link as a credential. Never paste it, or any key,
into a transcript, a commit, a PR or a doc.

### Verified behaviour, signed out

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/agents               # 307 -> /login
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/v1/sessions   # 401
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS http://localhost:3000/api/v1/sessions  # 204
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sdk/voice-studio.js  # 200
```

The 401 is the important one. If a public API route starts redirecting to `/login`,
every SDK and the widget are broken.

## What the migration replaced

A hand-rolled session: scrypt password hashes, opaque tokens in a `sessions` table, a
`vs_session` cookie, `signIn` / `signUp` / `signOut` server actions, and
`scripts/session.mjs`, which minted a session row so an agent could fetch a signed-in
page with `curl`.

That last one is the real cost. There is no cookie to mint any more, so a signed-in check
needs a real session:

- sign in as a Clerk **development** test user through the preview browser tools, or
- add `@clerk/testing` and drive the flow with a testing token.

`pnpm seed` still works, because it writes tenants, agents and keys and drives calls over
`/api/v1`, none of which Clerk touches. Pass `SEED_CLERK_USER_ID=user_xxx` so the seeded
workspace belongs to your account; otherwise its owner is a placeholder and no signed-in
operator can see the traffic.

Do not restore a cookie path, a dev-only auto sign-in, or any flag that skips the gate to
make verification cheaper.

---
name: studio-auth
description: Work on Voice Studio sign-in, Clerk sessions, the route gate, or the operator identity. Use when touching src/proxy.ts, src/lib/auth/*, the login and signup screens, tenant provisioning, who-is-signed-in on the server, when a page unexpectedly redirects to login, or when a scripted signed-in fetch returns 307.
---

# Auth

Two credential systems, and they never mix:

| Who | Credential | Guarded by |
| --- | --- | --- |
| A human operator | browser session | `src/proxy.ts` plus the server helper on every page |
| Another program | `vs_sk_live_`, `vs_pk_live_`, `vst_` | the handler itself, via `requireApiKey` / `resolveSessionToken` |

**Clerk is the decision for humans only.** It must never guard `/api/v1`, `/api/media`,
`/widget` or `/sdk`. Those are other people's software calling us with our keys, and
Clerk has no opinion about them.

## Invariants

Break any of these and the change is wrong, whatever the ticket says.

1. **No bypass, in any environment.** No `authBypass`, no `NODE_ENV` branch that skips
   the gate, no "dev only" auto sign-in. If verification gets harder, verification
   changes, not the gate.
2. **`src/proxy.ts` is the whole gate.** One `PUBLIC` list. Adding a pattern there can
   expose an operator surface to anonymous traffic, so justify each entry in the PR.
3. **Tenant scoping survives.** Every store call takes a tenant id from the resolved
   session, never from a request body, a query string or a header.
4. **One session concept per caller.** A human never authenticates with an API key, and
   a program never carries a browser session.

## How sign-in works

Clerk owns the credential, this repo owns the tenant. Nothing in between.

- `src/proxy.ts` runs `clerkMiddleware()`. Every route outside the `createRouteMatcher`
  list calls `auth.protect()`, which redirects a browser to `/login` and answers an API
  caller with a 307 it should never see, because `/api/v1` is on the public list.
- `src/app/layout.tsx` wraps the tree in `<ClerkProvider afterSignOutUrl="/login">`.
- `/login/[[...rest]]` and `/signup/[[...rest]]` render Clerk's `<SignIn />` and
  `<SignUp />` inside the existing paper card. `src/components/auth/appearance.ts`
  strips Clerk's own card and applies the studio palette.
- `getAuth()` in `src/lib/auth/session.ts` reads `auth()`, then resolves the workspace
  from the `users` mirror row. `requireAuth()` is the same with a redirect.
- `users.clerk_user_id` is the join. Local ids stay `usr_`, so every foreign key
  (`tenants.owner_id`, `tenant_members.user_id`) is untouched by the migration.

First sign-in provisions, in `provision()`:

1. A `users` row with the same email already exists: it is adopted, the Clerk id is
   written onto it, and the seeded workspace with its agents, keys and calls stays.
2. No row: insert the mirror row, create a tenant named after the first name, insert the
   `tenant_members` row as owner.

`currentUser()` is called only on that first sight. Every later request is one local
`SELECT` by `clerk_user_id`.

## The Clerk application

The Clerk application `Voice Studio`
(`app_3HtyNkmMWhNyhFsXYktZgrLUICg`) exists on the `corkkam.info@gmail.com` account and
this repo is linked to it. Development instance only; production is not created, and it
stays that way while landmine 2 blocks a production deploy.

A fresh clone gets its keys with the CLI, which never prints a value:

```bash
clerk whoami                       # confirms the link
clerk env pull --file .env.local   # writes the two development keys
```

`.env.local` then holds `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`.
Never paste a key value into a transcript, a commit or a PR.

The development instance is configured to match this app, with `clerk config patch`:

| Setting | Value | Why |
| --- | --- | --- |
| Identifier | email address, verified by code at sign-up | one identifier, as the old form had |
| Password | on and required, min 15, HIBP enforced | Clerk defaults; do not lower them |
| Device trust | **off on development only** | it mails a code to a new device, and no one can read `demo@voice.studio` mail. Production must have it on |
| First name | collected and required | `AuthContext.user.name` and the shell user menu need it |
| Last name | collected, optional | |
| Organizations | off | tenancy is the `tenants` table, not Clerk orgs |
| Multi-session | off | one operator per browser |
| Paths | sign-in `/login`, sign-up `/signup`, home `/agents` | keeps every existing link working |
| Google | on, Clerk shared development credentials | development only; production needs our own client id |

Read the live values with `clerk config pull`, change them with
`clerk config patch --file <file> --dry-run` first. The development keys are set on the
Vercel project for Preview and Development; production has none, and gets none until the
datastore moves off SQLite.

## Signing in without a browser

`pnpm session` is the headless path an agent needs. `scripts/clerk.mjs` wraps the Clerk
Backend API; `scripts/session.mjs` creates a session for the seeded user and prints one
cookie holding three values:

| Cookie | Why the gate wants it |
| --- | --- |
| `__session` | the session token itself, short lived, `SESSION_TTL` raises it |
| `__client_uat` | last-active stamp. It is backdated on purpose: a stamp newer than the token reads as stale and answers 307 |
| `__clerk_db_jwt` | a dev browser token from the frontend API. Without it a development instance answers 307 with `x-clerk-auth-reason: dev-browser-missing` |

```bash
eval "$(pnpm -s session --export)"
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $VS_COOKIE" http://localhost:3000/agents
```

Re-run the command rather than keeping a cookie. If a signed-in fetch suddenly returns
307, read the `x-clerk-auth-reason` header before changing any code.

## Verify a change to the gate

```bash
pnpm typecheck && pnpm build
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/agents     # 307 to /login
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/v1/sessions  # 401, not a redirect
eval "$(pnpm -s session --export)"
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $VS_COOKIE" http://localhost:3000/agents  # 200
```

The second check is the one that catches a wrong matcher: if a public API route starts
redirecting to `/login`, every SDK and the widget are broken. For provisioning, sign in
as a brand new user in a browser and confirm `/agents`, `/calls` and `/keys` render.

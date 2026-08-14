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

## Today, before the migration

`src/lib/auth/*` holds a hand-rolled session: scrypt password hashes in `users`, opaque
tokens hashed into `sessions`, the `vs_session` cookie, `getAuth()` and `requireAuth()`
on the server, and `signIn` / `signUp` / `signOut` server actions. `scripts/session.mjs`
mints a row directly so agents can fetch a signed-in page with `curl`.

This works. Do not extend it. Any new auth work is the migration below.

## Migrating to Clerk

Verified against Next 16 and Clerk's current Next.js guide: the package is
`@clerk/nextjs`, `clerkMiddleware()` goes in `src/proxy.ts` (Next 16 renamed middleware
to proxy; the code is identical to the middleware form), `auth()` from
`@clerk/nextjs/server` is async, and `ClerkProvider` goes inside `<body>`.

**Prerequisite that no agent can satisfy alone:** a Clerk application, and its keys in
`.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Without
them the app cannot boot signed-in, so the work stays on a branch until the keys exist.
`npx -y clerk@latest init` sets up both, or take them from the Clerk dashboard. Never
paste a key value into a transcript, a commit or a PR.

### Shape of the change

Keep the tenant model exactly as it is. Clerk replaces identity, not tenancy.

1. `pnpm add @clerk/nextjs`.
2. `src/app/layout.tsx`: wrap the tree in `<ClerkProvider>` inside `<body>`.
3. `src/proxy.ts`: swap the cookie check for `clerkMiddleware()`, keeping the same
   public set. Everything not listed stays private.

   ```ts
   import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

   const isPublic = createRouteMatcher([
     '/login(.*)', '/signup(.*)', '/api/v1(.*)', '/api/media(.*)', '/widget(.*)', '/sdk(.*)',
   ])

   export default clerkMiddleware(async (auth, req) => {
     if (!isPublic(req)) await auth.protect()
   })

   export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
   ```

4. **Keep the `users` table as a local mirror**, with `users.id` holding the Clerk user
   id. Every foreign key (`tenants.owner_id`, `tenant_members.user_id`) then keeps
   working untouched, which is the whole reason to do it this way.
5. Replace `getAuth()` with one resolver that returns the same `AuthContext` the app
   already consumes, so no page, layout or view model changes:

   ```ts
   export async function getAuth(): Promise<AuthContext | null> {
     const { userId } = await auth()
     if (!userId) return null
     return resolveWorkspace(userId)   // mirror the user, provision a tenant on first sight
   }
   ```

   First sign-in provisions: upsert the mirror row, create the tenant, insert the
   `tenant_members` row as owner. That is the only new write.
6. Mount Clerk's components at the existing routes so no link breaks: `<SignIn />` at
   `/login/[[...rest]]`, `<SignUp />` at `/signup/[[...rest]]`, with
   `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`.
   Keep the paper shell around them.
7. `src/components/shell/UserMenu.tsx`: sign out through Clerk. Nothing else in the
   shell changes, because `toWorkspace()` still receives an `AuthContext`.
8. Delete, in the same PR: `src/lib/auth/password.ts`, the `signIn` / `signUp` /
   `signOut` actions, the `LoginForm` and `SignupForm` components, the `sessions` table
   and its writes, `SESSION_COOKIE`, and `AUTH_SECRET` from `.env.example`. A half-kept
   password path is a second front door.
9. `docs/` and `README.md` describe the local session flow. Correct them here.

### What this costs, and the answer

`scripts/session.mjs` stops working, because there is no `sessions` row to mint. That
removes the cheap headless page check that `studio-dev` relies on. Replace it in the
same change, not later:

- keep a seeded Clerk **development** test user, and sign in through the preview browser
  tools for visual checks, or
- add `@clerk/testing` and drive the signed-in flow with a testing token.

`pnpm seed` itself keeps working: it writes tenants, agents and keys, and drives calls
over `/api/v1`, none of which Clerk touches. Only the human sign-in half changes.

### Verify

```bash
pnpm typecheck && pnpm build
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/agents     # 307 to /login
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/v1/sessions  # 401, not a redirect
```

That second check is the one that catches a wrong matcher: if a public API route starts
redirecting to `/login`, every SDK and the widget are broken. Then sign in in a browser
and confirm `/agents`, `/calls` and `/keys` render for a brand-new user, which is also
the test that first-sign-in provisioning works.

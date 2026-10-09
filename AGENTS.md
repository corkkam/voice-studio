<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Voice Studio

Rules for this repo. `~/AGENTS.md` still applies; this file wins where they differ.
Read this before you touch code. Update it when a rule here goes stale.

## 1. What this is

A multi-tenant control plane for voice AI: build cascaded VAD -> STT -> LLM -> TTS
agents, watch them run, audit what they said.

Real today: sign-up and sessions, tenants, agents, API keys, live calls over the
public API, SSE monitor, call detail, campaign drafts, JS and Swift SDKs, an
embeddable widget.

Not real: telephony. There is no carrier, no PSTN number, no media plane. Turn audio
runs on the client (Web Speech / AVSpeech); the control plane only records the session
and completes the LLM turn. Never describe a call as dialled or as carrier traffic.

Surfaces and their shells:

| Group | Routes | Palette |
| --- | --- | --- |
| `(studio)` build | `/agents`, `/agents/[id]`, `/agents/new`, `/campaigns`, `/campaigns/[id]`, `/keys`, `/architecture` | paper, always light |
| `(ops)` run | `/calls`, `/calls/[id]` | dark, always dark |
| `(auth)` | `/login`, `/signup` | paper |
| public | `/widget/[agentId]`, `/api/v1/*`, `/api/media/*`, `/sdk/voice-studio.js` | n/a |

The two palettes are not light and dark mode. They are two products in one app.
Never add a theme toggle or a third palette.

## 2. The stack

One choice per layer. If a task seems to need a second choice at the same layer, that
is a decision to raise, not a dependency to install.

| Layer | Choice | How we use it |
| --- | --- | --- |
| Runtime | Node 26, pnpm | `pnpm` only. Never `npm`, `yarn` or `bun` in this repo. |
| Framework | Next 16 App Router, Turbopack | Server Components by default. `'use client'` only for a component that needs state, a ref or an event handler. |
| UI | React 19 | Local `useState`. `useActionState` for form pending and error state. Context only for shell-wide values, as `src/lib/fleet.tsx` and `runtime.tsx` already do. |
| Language | TypeScript strict | Row interfaces in `src/lib/store/types.ts` are the source of truth and flow outward. No `any`. |
| Styling | Tailwind v4 | `@theme` tokens in `src/app/globals.css`, used as classes. `src/components/ui/primitives.tsx` is the whole design system. |
| Data | Neon Postgres over `@neondatabase/serverless`, no ORM | Every SQL string lives in `src/lib/store/*` and every store function is async. `src/lib/db/index.ts` is the whole driver surface: `all`, `one` and `run`, with `?` placeholders rewritten to `$1..$n`. The schema is `src/lib/db/schema.sql`, applied by `pnpm db:push`. No ORM, no query builder, no second driver. |
| Auth, humans | Clerk (`@clerk/nextjs`) | Landed. `clerkMiddleware()` in `src/proxy.ts` is the gate, `getAuth()` in `src/lib/auth/session.ts` turns a Clerk user into a tenant. There is no password path left. |
| Auth, machines | Our API keys | `vs_sk_live_`, `vs_pk_live_`, `vst_`. Stays ours after the Clerk migration. Clerk never guards `/api/v1`. |
| Realtime | SSE plus an in-process hub | `src/lib/realtime/hub.ts`. No WebSocket server, no Redis, no third-party realtime service. |
| Model calls | One `fetch` in `src/lib/media/complete.ts` | Every provider in `src/lib/models/catalog.ts` speaks the OpenAI chat-completions shape, which is what keeps it one fetch. A provider that needs its own body shape is a decision to raise, not an entry to add. If streaming is needed, move that one file to the AI SDK through Vercel AI Gateway. Never add a provider SDK per call site. |
| Model routing | `src/lib/models/route.ts` | Request, then session, then agent, then the platform key. Choosing a model spends the tenant's own provider key, so it is a secret-key capability: never let a publishable key or a `vst_` token reach it. |
| Hosting | Vercel | Fluid compute, the default. Never `runtime = 'edge'`; the app needs Node APIs. |
| Logging | `console.error` on the server | No observability vendor until there is production traffic to observe. |

No linter and no test runner exist. `next lint` does not exist in Next 16 and ESLint was
never installed here. Adding either is a deliberate change of its own: ESLint as
`pnpm add -D eslint eslint-config-next` plus a flat config, a runner as Vitest when there
is behaviour worth pinning. Do not fold either into a feature, and never report a gate as
green when it does not exist.

## 3. Do not overdo it

The product is dense on screen and short on steps. Complexity that does not show up as a
better flow is a defect.

- **Three steps or fewer per core flow.** Sign in -> `/agents` -> agent -> test call.
  Keys: `/keys` -> create -> copy once. If a change adds a fourth step, cut something.
- **No wizards, no multi-step modals, no onboarding tour, no empty-state carousel.**
  A new agent is one form, pre-filled from `src/lib/data/defaults.ts`.
- **Defaults beat settings.** A control with one sensible value is a hardcoded value.
  Delete the control.
- **The page already has the data.** It is server-rendered. Do not add a spinner or a
  skeleton where server rendering has already resolved the value.
- **No optimistic UI on keys, money or publish.** Publish is the only write that changes
  live traffic; it stays explicit and confirmed.
- **Abstraction on the second real case.** Not the first, and never on a predicted one.
- **Never break a working flow to add a new one.** `/api/v1` is versioned and three SDKs
  ship against it; a shape change there is a breaking change to someone's app.
- **Delete rather than flag.** A feature flag that only ever has one value is dead code
  with extra branches.

## 4. Local loop

```bash
pnpm install
vercel env pull .env.local    # Neon DATABASE_URL, plus the Clerk development keys
pnpm db:push                  # applies src/lib/db/schema.sql, idempotent
pnpm dev                      # http://localhost:3000
pnpm seed                     # demo tenant, published agent, key pair, live calls
eval "$(pnpm -s session --export)"   # $VS_COOKIE for a signed-in fetch
```

Every script reads `.env.local`. It needs `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
from the Vercel project, and the Clerk development keys, which `clerk env pull --file
.env.local` will add if the Vercel pull did not carry them. Without those, nothing runs.

`pnpm db:push` is the only thing that writes DDL. Run it after any change to
`schema.sql`, and once on a fresh clone.

`pnpm seed` creates the demo operator as a real Clerk user, prints the login
(`demo@voice.studio` / `voicestudio-local`) and a fresh key pair. It writes the tenant
rows with SQL because a tenant is provisioned only when a human first signs in, then
drives the calls over `/api/v1` so the store, the hub and the monitor all see real
traffic. Re-running is safe; it rotates only its own keys. `pnpm session` mints a short
lived Clerk session, so re-run it rather than keeping `$VS_COOKIE` around.

There is no local database file any more. Local, preview and production all point at
the same Neon project through `DATABASE_URL`, so a local `DELETE` deletes the row for
everyone reading that branch. Use a Neon branch when you need to throw data away.

Gates before you claim anything works:

```bash
pnpm typecheck                # tsc --noEmit
pnpm build                    # both must be clean
```

## 5. Verify before you claim

A page render is checkable without a browser, so check it:

```bash
eval "$(pnpm -s session --export)"
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $VS_COOKIE" http://localhost:3000/calls
```

Every operator surface redirects to `/login` without that cookie, so a bare `curl`
of `/agents` proving "200" proves only that the gate works.

For anything visual, capture the screen. Use the preview browser tools if they answer;
if browser automation is unavailable in the session, say so plainly and report the
HTTP-level check instead. Do not describe pixels you did not see.

## 6. Landmines

Each of these has already cost time. None is visible from the code you are editing.

1. **There is no migration runner, only `pnpm db:push`.** `src/lib/db/schema.sql` is
   the whole schema and every statement in it is `IF NOT EXISTS`, so a column added to
   a `CREATE TABLE` is ignored on a database that already has that table. A new column
   needs the `CREATE TABLE` edit *and* an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   at the bottom of the file. Nothing runs DDL at request time, on purpose. See the
   `studio-schema` skill before changing a table.
2. **One Neon database serves local, preview and production.** The Vercel Marketplace
   resource `voice-studio-db` is connected to all three environments of the project
   `voice-studio`, so a laptop and a preview deploy write to the same rows. Branch the
   Neon project before anything destructive. Production is no longer blocked by the
   datastore; it is blocked by landmine 3.
3. **The realtime hub is an in-process `Map`.** `src/lib/realtime/hub.ts` fans out
   only inside one server process. Any multi-instance deployment loses monitor events.
   With the datastore shared this is now the one thing standing between the app and a
   hosted release, so a monitor that goes quiet on Vercel is this and not the database.
4. **The auth gate is `src/proxy.ts`.** Next 16 renamed middleware to proxy. The
   `createRouteMatcher` list passed to `clerkMiddleware()` is the entire gate: every
   route not in it calls `auth.protect()`. Adding a pattern there can expose an operator
   surface to anonymous traffic. `/api/v1`, `/api/media`, `/widget` and `/sdk` are
   public on purpose and guard themselves with API keys or session tokens. A public API
   route that starts redirecting to `/login` breaks all three SDKs and the widget, so
   check it with a bare `curl` after any change. Never add a bypass flag, in any
   environment.
5. **Two data layers, one direction.** `src/lib/store/*` owns SQL and is
   `server-only`. `src/lib/data/*` owns view models, types and design-time defaults.
   Components read view models. Never import a store module into a client component,
   and never write SQL in a component or a page.
6. **API key secrets are unrecoverable.** Only `sha256` hashes are stored. A key is
   shown once at creation. Never log a full key, never print one into a transcript,
   a PR, or a doc. Prefixes: `vs_sk_live_` secret, `vs_pk_live_` publishable, `vst_`
   per-session token.
7. **`docs/` is stale in one specific way.** The briefing pack was written on
   12 August 2026 and says the app is fixture-driven with no backend. Auth, the
   datastore and the public API landed after it, and it still names SQLite. Correct the
   claim in any doc you touch; do not cite it as current status.
8. **Orbs are canvas, and budgeted.** `LIVE_ORB_BUDGET` in `LiveCallGrid.tsx` drops
   on-screen orbs to a static frame past 24 visible cards, so a wallboard degrades to
   stillness instead of jank. Never add a continuously repainting CSS animation
   anywhere near the monitor.
9. **Tenant provider keys are encrypted, not hashed.** `src/lib/db/secrets.ts` wraps
   them with AES-256-GCM under `CREDENTIAL_SECRET`, because a turn has to present the
   key again. Rotating that variable makes every stored key undecryptable and there is
   no re-wrap path, so every tenant has to add its keys again. Say that before you
   rotate it. `useCredentialSecret` is the only function that decrypts; never return
   its result in a response, a log line or a view model.

## 7. Conventions

- **Style, as written:** single quotes, no semicolons, two-space indent, named
  exports, arrow callbacks. No formatter config exists; match the file you are in.
- **Server modules** that touch the database or the hub start with `import
  'server-only'`.
- **Route handlers** set `export const runtime = 'nodejs'`. Public routes also export
  `OPTIONS` and return `corsHeaders(req)` on every response.
- **Mutations are server actions** in a `actions.ts` beside the store they call, not
  API routes. `/api/v1` is for other people's software, not for our own forms.
- **Auth in a route** is `await requireApiKey(req)` for client traffic, the operator
  session helper for operator traffic, `await resolveSessionToken(raw)` for a `vst_`
  token. All three read the database, so all three are async. Publishable keys must
  never reach a server-side capability; the sessions route is the pattern.
- **Every store call is awaited.** A forgotten `await` on a store function is a truthy
  Promise, which typecheck will not catch: a missing `await getAgentRow(...)` inside an
  `if` reads as "found" for an agent that does not exist. Read a diff for this.
- **Ids** come from `id('agt')` and `token()` in `src/lib/db/ids.ts`. No `uuid`, no
  incrementing integers.
- **Colour** comes from the `@theme` tokens in `src/app/globals.css` as Tailwind
  classes (`bg-panel`, `text-ops-ink-2`, `border-line`). No raw hex in a component.
  Orange (`accent`) means a number breached a budget; do not spend it on decoration.
- **Shared UI** lives in `src/components/ui/primitives.tsx` (`Eyebrow`, `Button`,
  `Chip`, ...). Extend a primitive rather than restyling a one-off.
- **Numbers** render in `font-mono`, which carries tabular figures globally.
- **User-facing strings are plain ASCII.** No em dash, no smart quote, no middot in
  new copy. Existing components and `README.md` break this rule in many places; fix
  them where you are already working, never as a standalone sweep.
- **Model names in UI:** the builder's stage router names models because choosing
  them is the product. Nowhere else. No provider or model name in an error, a toast,
  the widget, or any end-user surface.

## 8. Versions, branches and environments

### Branches

Two long-lived branches, feature branches off `dev`:

```
feature/COR-123-thing  ->  dev  ->  main
```

- **`main` is production truth.** Only a release PR from `dev` lands here.
- **`dev` is the default branch** and where day-to-day work integrates.
- Branch name `<feature|bug>/<kebab-description>`. **A Linear ticket is not required**, and
  no work waits on one. Add a `COR-###` segment only when a ticket already exists. Never
  invent an id, and never create a ticket just to satisfy the format. The PR description
  is where the change gets explained.
- Never commit or push directly to `dev` or `main`. Branch, push the branch, open the
  PR with the `file-pr` skill.
- Use a worktree for branch work rather than switching in place; several agents share
  this repo.
- Delete the branch after merge. Keep `dev` and `main` in sync straight after a release.

### Versions

Semver in `package.json`, one tag per release on `main`:

```bash
pnpm version minor --no-git-tag-version   # on the release branch, then PR to main
git tag -a v0.3.0 -m "v0.3.0" && git push origin v0.3.0   # after the PR merges
```

- `0.x` while telephony and the datastore are unfinished. Nothing here is 1.0 until a
  hosted deployment is real.
- **Minor** for a new surface or a new `/api/v1` capability. **Patch** for fixes and
  copy. **Major** only for a breaking `/api/v1` or SDK change, which also means a new
  path segment rather than a silent shape change.
- The three SDKs and the widget version with the API, not with the app. If you change a
  request or response shape, say which of the four clients you updated.

### Environments

| Environment | Branch | Data | Auth instance | Use it for |
| --- | --- | --- | --- | --- |
| local | any | Neon `voice-studio-db` | Clerk development | real work, seeded traffic |
| preview | PR / `dev` | Neon `voice-studio-db`, the same rows | Clerk development | smoke test a UI change |
| production | `main` | Neon `voice-studio-db`, the same rows | Clerk production | blocked on landmine 3 |

- All three environments share one Neon database today. A preview deploy therefore
  reads and writes real local data, which makes it useful and makes it dangerous. Split
  it with a Neon branch per environment before anything ships to a user.
- Secrets live in `vercel env` and the local `.env.local`, never in git. Document a new
  variable in `.env.example` **by name only**. To set one, print the command, never the
  value.
- Development keys never reach production, production keys never reach a laptop.
- Names in use: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `XAI_API_KEY`,
  `CREDENTIAL_SECRET`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`. The Neon resource also
  sets a `POSTGRES_*` and `PG*` set that nothing here reads. `AUTH_SECRET` retired with
  the Clerk migration, `DATABASE_PATH` with the move off SQLite.

### Releasing

1. Gates green: `pnpm typecheck`, `pnpm build`.
2. Seed and verify the surfaces you touched, with the commands behind the claim.
3. Scan the diff for secrets and for a stray `data/`, `.env` or `.vercel` file.
4. Bump the version, PR `dev -> main`, tag after merge.
5. Production deploy stays blocked on the in-process realtime hub, not on the
   datastore. Name the blast radius before any deploy, preview included: a preview
   writes to the same Neon rows your laptop does.

## 9. Skills in this repo

`.claude/skills/`, invoked with `/<name>`:

| Skill | Use it when |
| --- | --- |
| `studio-dev` | Boot, seed and verify the app; get a signed-in page or a live call |
| `studio-auth` | Anything touching sign-in, sessions, the gate, or the Clerk migration |
| `studio-schema` | Add or change a table, column or index |
| `studio-api` | Add or change an `/api` route, a key kind, or an SDK surface |
| `studio-surface` | Add or change a screen, including the mocks-before-code step |
| `studio-ship` | Run the gates, cut a version, open the PR |

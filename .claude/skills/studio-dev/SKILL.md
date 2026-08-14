---
name: studio-dev
description: Boot, seed and verify Voice Studio locally. Use when asked to run or start the app, get a signed-in page, produce live calls or ended calls for the monitor, screenshot a surface, reproduce a bug that needs data, or check that a change works in the real app rather than in a type check.
---

# Run and verify Voice Studio

Every operator surface is behind the session gate in `src/proxy.ts`, and the monitor
is empty until calls exist. Fetching `/calls` with no cookie and reporting a redirect
proves nothing. Follow this order.

## 1. Boot

```bash
lsof -ti tcp:3000 || (pnpm dev > /tmp/vs-dev.log 2>&1 &)
for i in $(seq 1 40); do sleep 1; curl -s -o /dev/null http://localhost:3000/login && break; done
```

Ready in about 2 seconds. Keep the log; runtime errors land there, not in the terminal
you are watching. Do not kill a dev server another session may own without saying so.

## 2. Seed

```bash
pnpm seed                       # 3 sessions, 1 ended, 2 left live
SEED_CALLS=0 pnpm seed          # tenant, agent and keys only
SEED_CALLS=40 pnpm seed         # enough cards to exercise the virtual grid
```

Prints login `demo@voice.studio` / `voicestudio`, the agent id, and a fresh key pair.

Each run mints a new pair and deletes the previous seeded one, so a key you printed
earlier stops working after the next seed. When a script needs the values, capture them
from one run and reuse them; call `node scripts/seed.mjs` rather than `pnpm seed`, since
pnpm prints its own banner line into the output you are parsing.

```bash
OUT=$(SEED_CALLS=0 node scripts/seed.mjs)
KEY=$(echo "$OUT" | awk '/^Secret key/{print $3}')
AID=$(echo "$OUT" | awk '/^Agent/{print $2}')
```

Redact key values from anything you paste back:

```bash
pnpm seed 2>&1 | sed -E 's/(vs_(sk|pk)_live_)[A-Za-z0-9_-]+/\1REDACTED/g'
```

If the database does not exist yet, the script makes one unauthenticated API request so
the server creates the schema, then seeds. If it reports no database, the server is not
running.

## 3. Get a signed-in page

```bash
eval "$(pnpm -s session --export)"     # sets $VS_COOKIE
curl -s -H "Cookie: $VS_COOKIE" http://localhost:3000/agents | grep -c "Support Concierge"
```

`scripts/session.mjs` mints a real Clerk session over the Backend API, because sign-in is
a browser flow that no script can post to. The cookie carries three values the gate wants
on a development instance: the session token, a last-active stamp, and a dev browser
token. The session token is short-lived, so re-run the command rather than keeping a
cookie. Use it for any route under the gate.

Useful ids straight from the rendered page:

```bash
curl -s -H "Cookie: $VS_COOKIE" http://localhost:3000/calls  | grep -o 'call_[0-9a-f]\{16\}' | head -1
curl -s -H "Cookie: $VS_COOKIE" http://localhost:3000/agents | grep -o 'agt_[0-9a-f]\{16\}'  | head -1
```

## 4. Drive a call by hand

When you need a specific pipeline state rather than seeded traffic:

```bash
# $KEY and $AID from the capture above
S=$(curl -s -X POST http://localhost:3000/api/v1/sessions \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d "{\"agentId\":\"$AID\",\"channel\":\"api\",\"display\":\"Manual test\"}")
TOKEN=$(echo "$S" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
ID=$(echo "$S" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

curl -s -X POST http://localhost:3000/api/media/complete \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\",\"text\":\"hello\"}"

# park the card in one orb state: listening thinking speaking retrieving tool
# connecting transferring recovering idle
curl -s -X PATCH "http://localhost:3000/api/v1/sessions/$ID" \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"activity":"recovering","detail":"provider degraded"}'

curl -s -X DELETE "http://localhost:3000/api/v1/sessions/$ID" -H "Authorization: Bearer $KEY"
```

Without `XAI_API_KEY` on the server the reply is the fallback string and the response
carries `"fallback": true`. That is not a bug.

## 5. Look at it

For any visual claim, capture the screen with the preview browser tools: open
`http://localhost:3000/login`, sign in with the seeded credentials, then snapshot the
surface. Both palettes need a look when a change spans shells, because `(studio)` is
always paper and `(ops)` is always dark.

If browser automation does not answer in this session, do not guess and do not claim a
visual check. Report the HTTP-level evidence and say the screenshot is outstanding.

## 6. Reset

```bash
rm -f data/voice-studio.db data/voice-studio.db-shm data/voice-studio.db-wal
```

Git-ignored, so this destroys only local state. Restart the server afterwards so the
schema is recreated, then re-seed. Ask first if the database might hold work another
session needs.

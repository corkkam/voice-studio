#!/usr/bin/env node
/*
 * Local development seed.
 *
 * Three halves by now, because the app has three write paths and all need
 * exercising:
 *
 *   1. The demo operator is a real Clerk user, created over the Clerk Backend
 *      API, so the printed login works in a browser. Clerk owns the credential;
 *      this script only mirrors the id into the users table.
 *   2. Tenant, user, agent and API keys go straight into Postgres. There is no
 *      HTTP route that creates a tenant, and sign-up provisions one only when a
 *      human first signs in.
 *   3. Calls are driven over /api/v1 with the seeded secret key, so the live
 *      monitor, the SSE hub and the turn store all see real traffic rather than
 *      hand-written rows.
 *
 * The schema belongs to `pnpm db:push`, never to this script and no longer to
 * the app. Run that once against a fresh database before seeding.
 *
 * Usage: pnpm seed            (3 calls, keeps 2 live)
 *        SEED_CALLS=0 pnpm seed
 *        STUDIO_BASE_URL=http://localhost:3001 pnpm seed
 */

import { createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { clerkUserByEmail, createClerkUser } from './clerk.mjs'

const BASE = process.env.STUDIO_BASE_URL || 'http://localhost:3000'
const DATABASE_URL = process.env.DATABASE_URL
const CALLS = Number(process.env.SEED_CALLS ?? 3)

const DEMO = {
  email: process.env.SEED_EMAIL || 'demo@voice.studio',
  // Clerk's development instance requires 15 characters and rejects any
  // password found in a breach corpus, so this is longer than it looks.
  password: process.env.SEED_PASSWORD || 'voicestudio-local',
  name: 'Demo Operator',
  workspace: 'Demo Workspace',
  agent: 'Support Concierge',
}

const UTTERANCES = [
  'Hi, I need help with my last order.',
  'It was supposed to arrive on Tuesday.',
  'Can you check the status for me?',
]

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const id = (prefix) => `${prefix}_${randomBytes(8).toString('hex')}`
const token = (bytes = 32) => randomBytes(bytes).toString('base64url')

async function serverUp() {
  try {
    const res = await fetch(`${BASE}/api/v1/sessions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer vs_sk_live_seed_bootstrap_probe' },
    })
    return res.status === 401
  } catch {
    return false
  }
}

/* The tables come from `pnpm db:push`. Seeding an empty database would fail one
 * statement at a time, so it is checked up front and named as one instruction. */
async function ensureSchema(sql) {
  const [{ ready }] = await sql.query(
    `SELECT COUNT(*) = 4 AS ready FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('users', 'tenants', 'agents', 'api_keys')`,
  )
  if (ready) return true
  console.error('The database has no schema yet. Create it with: pnpm db:push')
  return false
}

// The app provisions a tenant when a human first signs in. A seeded workspace
// has to exist before that, so the same rows are written here and the Clerk id
// is stored beside them. The first sign-in then adopts this row by email
// instead of creating a second, empty workspace.
async function ensureClerkUser() {
  const existing = await clerkUserByEmail(DEMO.email)
  if (existing) return { clerkUserId: existing.id, created: false }

  const [firstName, ...rest] = DEMO.name.split(' ')
  const user = await createClerkUser({
    email: DEMO.email,
    password: DEMO.password,
    firstName,
    lastName: rest.join(' '),
  })
  return { clerkUserId: user.id, created: true }
}

async function ensureTenant(sql, clerkUserId) {
  const [existing] = await sql.query('SELECT id FROM users WHERE email = $1', [DEMO.email])
  if (existing) {
    await sql.query('UPDATE users SET clerk_user_id = $1 WHERE id = $2', [clerkUserId, existing.id])
    const [member] = await sql.query(
      'SELECT tenant_id FROM tenant_members WHERE user_id = $1 LIMIT 1',
      [existing.id],
    )
    return { userId: existing.id, tenantId: member.tenant_id, created: false }
  }

  const created = Date.now()
  const userId = id('usr')
  const tenantId = id('ten')
  let slug = 'demo-workspace'
  let n = 1
  while ((await sql.query('SELECT 1 FROM tenants WHERE slug = $1', [slug])).length) {
    slug = `demo-workspace-${++n}`
  }

  await sql.query(
    'INSERT INTO users (id, clerk_user_id, email, name, created_at) VALUES ($1, $2, $3, $4, $5)',
    [userId, clerkUserId, DEMO.email, DEMO.name, created],
  )
  await sql.query(
    `INSERT INTO tenants (id, name, slug, region, owner_id, created_at)
     VALUES ($1, $2, $3, 'IN-SOUTH', $4, $5)`,
    [tenantId, DEMO.workspace, slug, userId, created],
  )
  await sql.query(
    "INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ($1, $2, 'owner')",
    [tenantId, userId],
  )

  return { userId, tenantId, created: true }
}

async function ensureAgent(sql, tenantId) {
  const [existing] = await sql.query(
    'SELECT id, status FROM agents WHERE tenant_id = $1 AND name = $2',
    [tenantId, DEMO.agent],
  )
  if (existing) {
    if (existing.status !== 'live') {
      await sql.query("UPDATE agents SET status = 'live', published_at = $1 WHERE id = $2", [
        Date.now(),
        existing.id,
      ])
    }
    return { agentId: existing.id, created: false }
  }

  const created = Date.now()
  const agentId = id('agt')
  // The pipeline column is the design-time latency budget the builder renders.
  // Keeping it empty is legal but the builder then shows no stages, so seed the
  // shape the app ships as its default.
  const pipeline = JSON.stringify([
    { key: 'vad', step: '1 * VAD + TURN', model: 'Silero v5', detail: 'seeded', hosting: 'client SDK', hostingTone: 'good', latencyMs: 42, cost: 'local', budgetColor: '#1c1917', budgetLabel: 'VAD 42' },
    { key: 'stt', step: '2 * STT', model: 'Platform / device STT', detail: 'seeded', hosting: 'client SDK', hostingTone: 'good', latencyMs: 208, cost: 'local', budgetColor: '#e4572e', budgetLabel: 'STT 208' },
    { key: 'llm', step: '3 * LLM', model: 'grok-4.6', detail: 'seeded', hosting: 'control plane', hostingTone: 'muted', latencyMs: 168, cost: 'BYO / platform', active: true, budgetColor: 'oklch(0.62 0.15 55)', budgetLabel: 'LLM 168' },
    { key: 'tts', step: '4 * TTS', model: 'Platform / device TTS', detail: 'seeded', hosting: 'client SDK', hostingTone: 'good', latencyMs: 74, cost: 'local', budgetColor: 'oklch(0.6 0.13 172)', budgetLabel: 'TTS 74' },
    { key: 'transport', step: '5 * TRANSPORT', model: 'REST + SSE', detail: 'seeded', hosting: 'licensed later', hostingTone: 'muted', latencyMs: 31, cost: 'session', budgetColor: '#b8afa4', budgetLabel: 'playback 31' },
  ])

  await sql.query(
    `INSERT INTO agents (
      id, tenant_id, name, slug, locale, locale_tone, summary, status,
      pipeline_json, series, carrier, system_prompt, topology, version,
      created_at, updated_at, published_at
    ) VALUES ($1, $2, $3, $4, 'en', 'neutral', $5, 'live', $6, 'Web / SDK', 'Web + macOS', $7, 'cascaded', 1, $8, $9, $10)`,
    [
      agentId,
      tenantId,
      DEMO.agent,
      'support-concierge',
      'Seeded agent for local development',
      pipeline,
      'You are a concise support voice agent. Ask one question at a time.',
      created,
      created,
      created,
    ],
  )
  return { agentId, created: true }
}

async function rotateKeys(sql, tenantId) {
  // A key hash is one-way, so a re-run cannot print an existing secret. Drop the
  // seeded pair and mint a fresh one instead of piling up dead keys.
  await sql.query("DELETE FROM api_keys WHERE tenant_id = $1 AND name LIKE 'Seed %'", [tenantId])

  const mint = async (kind, name) => {
    const secret = `vs_${kind === 'publishable' ? 'pk' : 'sk'}_live_${token(24)}`
    await sql.query(
      `INSERT INTO api_keys (
        id, tenant_id, name, prefix, key_hash, kind, origins_json, last_used_at, created_at, revoked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, NULL)`,
      [id('key'), tenantId, name, secret.slice(0, 16), sha256(secret), kind, Date.now()],
    )
    return secret
  }

  return {
    secret: await mint('secret', 'Seed secret'),
    publishable: await mint('publishable', 'Seed publishable'),
  }
}

async function driveCalls(agentId, secretKey) {
  const opened = []
  let fallback = false
  for (let i = 0; i < CALLS; i += 1) {
    const res = await fetch(`${BASE}/api/v1/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, channel: 'api', display: `Seed caller ${i + 1}` }),
    })
    if (!res.ok) {
      console.error(`  session ${i + 1}: ${res.status} ${(await res.text()).slice(0, 120)}`)
      continue
    }
    const session = await res.json()
    opened.push(session)

    for (const text of UTTERANCES.slice(0, 1 + (i % UTTERANCES.length))) {
      const turn = await fetch(`${BASE}/api/media/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token, text }),
      })
      if (!turn.ok) {
        console.error(`  turn: ${turn.status} ${(await turn.text()).slice(0, 120)}`)
        continue
      }
      // The script cannot read the server's env, so the server tells us whether
      // the reply came from a live model or from the no-key fallback.
      fallback = fallback || Boolean((await turn.json()).fallback)
    }

    // Leave most calls live for the monitor, end one so the ended strip and the
    // call-detail page have something to show.
    if (i === 0 && CALLS > 1) {
      await fetch(`${BASE}/api/v1/sessions/${session.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${secretKey}` },
      })
    }
  }
  return { opened, fallback }
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set. Pull it with: vercel env pull .env.local')
    process.exit(1)
  }
  const sql = neon(DATABASE_URL)
  if (!(await ensureSchema(sql))) process.exit(1)

  const clerkUser = await ensureClerkUser()

  const tenant = await ensureTenant(sql, clerkUser.clerkUserId)
  const agent = await ensureAgent(sql, tenant.tenantId)
  const keys = await rotateKeys(sql, tenant.tenantId)

  console.log(`Workspace  ${tenant.tenantId} ${tenant.created ? '(created)' : '(existing)'}`)
  console.log(
    `Login      ${DEMO.email} / ${DEMO.password}` +
      (clerkUser.created ? ' (Clerk user created)' : ' (existing Clerk user)'),
  )
  console.log(`Agent      ${agent.agentId} ${agent.created ? '(created)' : '(existing, published)'}`)
  console.log(`Secret key ${keys.secret}`)
  console.log(`Public key ${keys.publishable}`)

  if (CALLS > 0) {
    if (await serverUp()) {
      console.log(`\nDriving ${CALLS} session(s) against ${BASE}`)
      const { opened, fallback } = await driveCalls(agent.agentId, keys.secret)
      console.log(`Opened ${opened.length} session(s). Monitor: ${BASE}/calls`)
      if (fallback) {
        console.log('Replies are the no-key fallback. Set XAI_API_KEY on the server for live turns.')
      }
    } else {
      console.log(`\n${BASE} is not answering. Start pnpm dev, then re-run to generate calls.`)
    }
  }

  console.log(`\nWidget preview: ${BASE}/widget/${agent.agentId}`)
}

await main()

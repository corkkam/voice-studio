#!/usr/bin/env node
/*
 * Local development seed.
 *
 * Two halves, because the app has two write paths and both need exercising:
 *
 *   1. Tenant, user, agent and API keys go straight into the SQLite file. There
 *      is no HTTP route that creates a tenant (sign-up is a server action, and
 *      server actions cannot be called from a script).
 *   2. Calls are driven over /api/v1 with the seeded secret key, so the live
 *      monitor, the SSE hub and the turn store all see real traffic rather than
 *      hand-written rows.
 *
 * The schema is created by the app (`bootstrap()` in src/lib/db/index.ts), never
 * here. If the DB file is missing, one unauthorised API request is enough to make
 * the server open the connection and create the tables.
 *
 * Usage: pnpm seed            (3 calls, keeps 2 live)
 *        SEED_CALLS=0 pnpm seed
 *        STUDIO_BASE_URL=http://localhost:3001 pnpm seed
 */

import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.STUDIO_BASE_URL || 'http://localhost:3000'
const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'voice-studio.db')
const CALLS = Number(process.env.SEED_CALLS ?? 3)

const DEMO = {
  email: process.env.SEED_EMAIL || 'demo@voice.studio',
  password: process.env.SEED_PASSWORD || 'voicestudio',
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

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`
}

async function serverUp() {
  try {
    const res = await fetch(`${BASE}/api/v1/sessions`, { method: 'POST' })
    return res.status === 401
  } catch {
    return false
  }
}

async function ensureDb() {
  if (existsSync(DB_PATH)) return true
  const up = await serverUp()
  if (up && existsSync(DB_PATH)) return true
  console.error(
    `No database at ${DB_PATH}.\n` +
      `Start the app once so it creates the schema: pnpm dev, then re-run pnpm seed.`,
  )
  return false
}

function ensureTenant(db) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO.email)
  if (existing) {
    const member = db
      .prepare('SELECT tenant_id FROM tenant_members WHERE user_id = ? LIMIT 1')
      .get(existing.id)
    return { userId: existing.id, tenantId: member.tenant_id, created: false }
  }

  const created = Date.now()
  const userId = id('usr')
  const tenantId = id('ten')
  let slug = 'demo-workspace'
  let n = 1
  while (db.prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) slug = `demo-workspace-${++n}`

  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(userId, DEMO.email, hashPassword(DEMO.password), DEMO.name, created)
  db.prepare(
    `INSERT INTO tenants (id, name, slug, region, owner_id, created_at)
     VALUES (?, ?, ?, 'IN-SOUTH', ?, ?)`,
  ).run(tenantId, DEMO.workspace, slug, userId, created)
  db.prepare(
    "INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, 'owner')",
  ).run(tenantId, userId)

  return { userId, tenantId, created: true }
}

function ensureAgent(db, tenantId) {
  const existing = db
    .prepare('SELECT id, status FROM agents WHERE tenant_id = ? AND name = ?')
    .get(tenantId, DEMO.agent)
  if (existing) {
    if (existing.status !== 'live') {
      db.prepare("UPDATE agents SET status = 'live', published_at = ? WHERE id = ?").run(
        Date.now(),
        existing.id,
      )
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

  db.prepare(
    `INSERT INTO agents (
      id, tenant_id, name, slug, locale, locale_tone, summary, status,
      pipeline_json, series, carrier, system_prompt, topology, version,
      created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, 'en', 'neutral', ?, 'live', ?, 'Web / SDK', 'Web + macOS', ?, 'cascaded', 1, ?, ?, ?)`,
  ).run(
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
  )
  return { agentId, created: true }
}

function rotateKeys(db, tenantId) {
  // A key hash is one-way, so a re-run cannot print an existing secret. Drop the
  // seeded pair and mint a fresh one instead of piling up dead keys.
  db.prepare("DELETE FROM api_keys WHERE tenant_id = ? AND name LIKE 'Seed %'").run(tenantId)

  const mint = (kind, name) => {
    const secret = `vs_${kind === 'publishable' ? 'pk' : 'sk'}_live_${token(24)}`
    db.prepare(
      `INSERT INTO api_keys (
        id, tenant_id, name, prefix, key_hash, kind, origins_json, last_used_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
    ).run(id('key'), tenantId, name, secret.slice(0, 16), sha256(secret), kind, Date.now())
    return secret
  }

  return { secret: mint('secret', 'Seed secret'), publishable: mint('publishable', 'Seed publishable') }
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
  if (!(await ensureDb())) process.exit(1)

  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  const tenant = ensureTenant(db)
  const agent = ensureAgent(db, tenant.tenantId)
  const keys = rotateKeys(db, tenant.tenantId)
  db.close()

  console.log(`Workspace  ${tenant.tenantId} ${tenant.created ? '(created)' : '(existing)'}`)
  console.log(`Login      ${DEMO.email} / ${DEMO.password}`)
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

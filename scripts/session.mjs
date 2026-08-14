#!/usr/bin/env node
/*
 * Mint a browser session for the seeded demo user and print it as a cookie.
 *
 * Sign-in is a server action, so nothing outside the app can post to it. Without
 * this, an agent or a script has no way to fetch a signed-in page, and every
 * operator surface (/agents, /calls, /campaigns, /keys) redirects to /login.
 *
 * Usage: eval "$(pnpm -s session --export)"   # sets $VS_COOKIE
 *        curl -s -H "Cookie: $VS_COOKIE" http://localhost:3000/agents
 */

import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'voice-studio.db')
const EMAIL = process.env.SEED_EMAIL || 'demo@voice.studio'
const EXPORT = process.argv.includes('--export')
const SESSION_MS = 14 * 24 * 60 * 60 * 1000

if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}. Run pnpm dev once, then pnpm seed.`)
  process.exit(1)
}

const db = new DatabaseSync(DB_PATH)
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(EMAIL)
if (!user) {
  console.error(`No user ${EMAIL}. Run pnpm seed first.`)
  process.exit(1)
}

const raw = randomBytes(32).toString('base64url')
const created = Date.now()
db.prepare(
  'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
).run(
  `ses_${randomBytes(8).toString('hex')}`,
  user.id,
  createHash('sha256').update(raw).digest('hex'),
  created + SESSION_MS,
  created,
)
db.close()

const cookie = `vs_session=${raw}`
console.log(EXPORT ? `export VS_COOKIE='${cookie}'` : cookie)

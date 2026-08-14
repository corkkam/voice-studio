import 'server-only'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'

const DATA_DIR = join(process.cwd(), 'data')
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'voice-studio.db')
const SECRET_PATH = join(DATA_DIR, '.auth-secret')

type GlobalDb = typeof globalThis & {
  __voiceStudioDb?: DatabaseSync
  __voiceStudioSecret?: string
}

const globalDb = globalThis as GlobalDb

function bootstrap(db: DatabaseSync) {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    -- A mirror of the Clerk user, keyed by the Clerk user id, so the tenancy
    -- foreign keys below need no change. password_hash is dead weight kept
    -- because it is NOT NULL on databases created before Clerk landed.
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL DEFAULT 'IN-SOUTH',
      owner_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenant_members (
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'owner',
      PRIMARY KEY (tenant_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      locale_tone TEXT NOT NULL DEFAULT 'neutral',
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      pipeline_json TEXT NOT NULL,
      series TEXT NOT NULL DEFAULT 'Web / SDK',
      carrier TEXT NOT NULL DEFAULT 'Web + macOS',
      system_prompt TEXT NOT NULL DEFAULT '',
      topology TEXT NOT NULL DEFAULT 'cascaded',
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      published_at INTEGER,
      UNIQUE (tenant_id, slug)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      origins_json TEXT,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      channel TEXT NOT NULL,
      display TEXT NOT NULL,
      locale TEXT NOT NULL,
      status TEXT NOT NULL,
      activity TEXT NOT NULL,
      activity_detail TEXT NOT NULL DEFAULT '',
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      v2v_ms INTEGER,
      barge_ins INTEGER NOT NULL DEFAULT 0,
      outcome TEXT,
      sentiment TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS call_turns (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      at_ms INTEGER NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      tool TEXT,
      v2v_ms INTEGER,
      stt_ms INTEGER,
      llm_ms INTEGER,
      tts_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS session_tokens (
      token_hash TEXT PRIMARY KEY,
      call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      agent_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calls_tenant_status ON calls(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_calls_tenant_ended ON calls(tenant_id, ended_at);
    CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_turns_call ON call_turns(call_id, seq);
  `)
}

export function getDb(): DatabaseSync {
  if (globalDb.__voiceStudioDb) return globalDb.__voiceStudioDb
  mkdirSync(dirname(DB_PATH), { recursive: true })
  const db = new DatabaseSync(DB_PATH)
  bootstrap(db)
  globalDb.__voiceStudioDb = db
  return db
}

export function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (globalDb.__voiceStudioSecret) return globalDb.__voiceStudioSecret
  mkdirSync(DATA_DIR, { recursive: true })
  try {
    const existing = readFileSync(SECRET_PATH, 'utf8').trim()
    if (existing) {
      globalDb.__voiceStudioSecret = existing
      return existing
    }
  } catch {
    // first boot
  }
  const secret = randomBytes(32).toString('hex')
  writeFileSync(SECRET_PATH, secret, { mode: 0o600 })
  globalDb.__voiceStudioSecret = secret
  return secret
}

export function now(): number {
  return Date.now()
}

export function plain<T>(value: unknown): T {
  return { ...(value as object) } as T
}

export function rows<T>(value: unknown): T[] {
  return (value as unknown[]).map((item) => plain<T>(item))
}

export function row<T>(value: unknown): T | undefined {
  if (value == null) return undefined
  return plain<T>(value)
}

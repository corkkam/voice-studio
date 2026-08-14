import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb, now } from '@/lib/db'
import { id, token } from '@/lib/db/ids'
import { sha256 } from '@/lib/auth/password'
import { SESSION_COOKIE } from '@/lib/auth/constants'
import type { TenantRow, UserRow } from '@/lib/store/types'

export { SESSION_COOKIE }

const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export interface AuthContext {
  user: { id: string; email: string; name: string }
  tenant: { id: string; name: string; slug: string; region: string }
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb()
  const raw = token()
  const created = now()
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id('ses'), userId, sha256(raw), created + SESSION_MS, created)

  const jar = await cookies()
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(created + SESSION_MS),
  })
  return raw
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (raw) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(raw))
  }
  jar.delete(SESSION_COOKIE)
}

export async function getAuth(): Promise<AuthContext | null> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const row = getDb()
    .prepare(
      `SELECT u.id AS user_id, u.email, u.name,
              t.id AS tenant_id, t.name AS tenant_name, t.slug, t.region,
              s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenant_members m ON m.user_id = u.id
       JOIN tenants t ON t.id = m.tenant_id
       WHERE s.token_hash = ?
       LIMIT 1`,
    )
    .get(sha256(raw)) as
    | {
        user_id: string
        email: string
        name: string
        tenant_id: string
        tenant_name: string
        slug: string
        region: string
        expires_at: number
      }
    | undefined

  if (!row || row.expires_at < now()) {
    if (row) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(raw))
    return null
  }

  return {
    user: { id: row.user_id, email: row.email, name: row.name },
    tenant: { id: row.tenant_id, name: row.tenant_name, slug: row.slug, region: row.region },
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth()
  if (!auth) redirect('/login')
  return auth
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase()) as UserRow | undefined
}

export function insertUser(input: {
  email: string
  name: string
  passwordHash: string
  tenantName: string
}): { user: UserRow; tenant: TenantRow } {
  const db = getDb()
  const created = now()
  const userId = id('usr')
  const tenantId = id('ten')
  const slugBase = input.tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace'
  let slug = slugBase
  let n = 1
  while (db.prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) {
    slug = `${slugBase}-${++n}`
  }

  const insertUserStmt = db.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`,
  )
  const insertTenant = db.prepare(
    `INSERT INTO tenants (id, name, slug, region, owner_id, created_at) VALUES (?, ?, ?, 'IN-SOUTH', ?, ?)`,
  )
  const insertMember = db.prepare(
    `INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, 'owner')`,
  )

  insertUserStmt.run(userId, input.email.toLowerCase(), input.passwordHash, input.name, created)
  insertTenant.run(tenantId, input.tenantName, slug, userId, created)
  insertMember.run(tenantId, userId)

  return {
    user: {
      id: userId,
      email: input.email.toLowerCase(),
      password_hash: input.passwordHash,
      name: input.name,
      created_at: created,
    },
    tenant: {
      id: tenantId,
      name: input.tenantName,
      slug,
      region: 'IN-SOUTH',
      owner_id: userId,
      created_at: created,
    },
  }
}

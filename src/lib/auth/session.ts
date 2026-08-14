import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getDb, now, row } from '@/lib/db'
import { id } from '@/lib/db/ids'

/**
 * Clerk owns identity. This module owns tenancy, and translates one into the
 * other.
 *
 * `users` is a local mirror keyed by the Clerk user id, which keeps every
 * existing foreign key working: `tenants.owner_id` and `tenant_members.user_id`
 * still point at `users.id`. Nothing downstream of `AuthContext` changed.
 */
export interface AuthContext {
  user: { id: string; email: string; name: string }
  tenant: { id: string; name: string; slug: string; region: string }
}

export async function getAuth(): Promise<AuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null
  return readWorkspace(userId) ?? (await provisionWorkspace(userId))
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuth()
  if (!context) redirect('/login')
  return context
}

function readWorkspace(userId: string): AuthContext | null {
  const found = row<{
    user_id: string
    email: string
    name: string
    tenant_id: string
    tenant_name: string
    slug: string
    region: string
  }>(
    getDb()
      .prepare(
        `SELECT u.id AS user_id, u.email, u.name,
                t.id AS tenant_id, t.name AS tenant_name, t.slug, t.region
         FROM users u
         JOIN tenant_members m ON m.user_id = u.id
         JOIN tenants t ON t.id = m.tenant_id
         WHERE u.id = ?
         LIMIT 1`,
      )
      .get(userId),
  )
  if (!found) return null
  return {
    user: { id: found.user_id, email: found.email, name: found.name },
    tenant: {
      id: found.tenant_id,
      name: found.tenant_name,
      slug: found.slug,
      region: found.region,
    },
  }
}

/**
 * First sight of a Clerk user: mirror them, then give them a workspace. One
 * transaction, so two concurrent first requests cannot produce two tenants.
 * There is no onboarding step by design; the workspace is named from the
 * account and everything else comes from the defaults.
 */
async function provisionWorkspace(userId: string): Promise<AuthContext> {
  const clerkUser = await currentUser()
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? ''
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    email.split('@')[0] ||
    'Operator'
  const workspace = `${name.split(' ')[0] || 'New'} workspace`

  const db = getDb()
  const created = now()
  const tenantId = id('ten')
  const slugBase =
    workspace
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  let slug = slugBase
  let n = 1
  while (db.prepare('SELECT 1 FROM tenants WHERE slug = ?').get(slug)) {
    slug = `${slugBase}-${++n}`
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    // password_hash predates Clerk and is NOT NULL on databases created before
    // this change, so it is written empty rather than dropped.
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, '', ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name`,
    ).run(userId, email, name, created)
    db.prepare(
      `INSERT INTO tenants (id, name, slug, region, owner_id, created_at)
       VALUES (?, ?, ?, 'IN-SOUTH', ?, ?)`,
    ).run(tenantId, workspace, slug, userId, created)
    db.prepare(
      `INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, 'owner')`,
    ).run(tenantId, userId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    // A concurrent request may have won the race and provisioned already.
    const existing = readWorkspace(userId)
    if (existing) return existing
    throw error
  }

  return {
    user: { id: userId, email, name },
    tenant: { id: tenantId, name: workspace, slug, region: 'IN-SOUTH' },
  }
}

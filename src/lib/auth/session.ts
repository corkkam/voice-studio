import 'server-only'

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { now, one, run } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { UserRow } from '@/lib/store/types'

export interface AuthContext {
  user: { id: string; email: string; name: string }
  tenant: { id: string; name: string; slug: string; region: string }
}

interface WorkspaceRow {
  user_id: string
  email: string
  name: string
  tenant_id: string
  tenant_name: string
  slug: string
  region: string
}

const WORKSPACE_SQL = `
  SELECT u.id AS user_id, u.email, u.name,
         t.id AS tenant_id, t.name AS tenant_name, t.slug, t.region
  FROM users u
  JOIN tenant_members m ON m.user_id = u.id
  JOIN tenants t ON t.id = m.tenant_id
  WHERE u.clerk_user_id = ?
  LIMIT 1`

/*
 * Clerk owns identity, this app owns tenancy. Every page and action reads the
 * tenant from here, so a Clerk user with no mirror row is provisioned on first
 * sight rather than bounced back to sign-in.
 */
export async function getAuth(): Promise<AuthContext | null> {
  const { userId } = await auth()
  if (!userId) return null

  const existing = await read(userId)
  if (existing) return existing

  await provision(userId)
  return read(userId)
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuth()
  if (!context) redirect('/login')
  return context
}

async function read(clerkUserId: string): Promise<AuthContext | null> {
  const row = await one<WorkspaceRow>(WORKSPACE_SQL, [clerkUserId])
  if (!row) return null
  return {
    user: { id: row.user_id, email: row.email, name: row.name },
    tenant: { id: row.tenant_id, name: row.tenant_name, slug: row.slug, region: row.region },
  }
}

/*
 * First sign-in for a Clerk user. Two shapes arrive here: a genuinely new
 * account, and an account whose email already owns a tenant, which is how the
 * seeded demo workspace survives the move off password sign-in. Both end with
 * one users row carrying the Clerk id, and one tenant membership.
 */
async function provision(clerkUserId: string): Promise<void> {
  const clerkUser = await currentUser()
  if (!clerkUser) return

  const email = primaryEmail(clerkUser)
  if (!email) return
  const name = displayName(clerkUser, email)

  const claimed = await one<UserRow>('SELECT * FROM users WHERE email = ?', [email])

  if (claimed?.clerk_user_id && claimed.clerk_user_id !== clerkUserId) return

  const userId = claimed?.id ?? id('usr')
  if (claimed) {
    await run('UPDATE users SET clerk_user_id = ?, name = ? WHERE id = ?', [
      clerkUserId,
      name,
      userId,
    ])
  } else {
    await run('INSERT INTO users (id, clerk_user_id, email, name, created_at) VALUES (?, ?, ?, ?, ?)', [
      userId,
      clerkUserId,
      email,
      name,
      now(),
    ])
  }

  const member = await one('SELECT tenant_id FROM tenant_members WHERE user_id = ? LIMIT 1', [userId])
  if (!member) await createTenant(userId, name)
}

async function createTenant(userId: string, name: string): Promise<void> {
  const created = now()
  const tenantId = id('ten')
  const tenantName = `${name.split(' ')[0]}'s Workspace`
  const base =
    tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace'
  let slug = base
  let n = 1
  while (await one('SELECT 1 FROM tenants WHERE slug = ?', [slug])) slug = `${base}-${++n}`

  await run(
    `INSERT INTO tenants (id, name, slug, region, owner_id, created_at)
     VALUES (?, ?, ?, 'IN-SOUTH', ?, ?)`,
    [tenantId, tenantName, slug, userId, created],
  )
  await run("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, 'owner')", [
    tenantId,
    userId,
  ])
}

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>

function primaryEmail(user: ClerkUser): string | null {
  const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
  const address = primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress
  return address ? address.toLowerCase() : null
}

function displayName(user: ClerkUser, email: string): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || email.split('@')[0]
}

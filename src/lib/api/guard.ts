import { getAuth } from '@/lib/auth/session'
import { resolveApiKey } from '@/lib/store/keys'
import { bearer } from '@/lib/api/http'
import type { ApiKeyRow } from '@/lib/store/types'

export async function requireOperator() {
  const auth = await getAuth()
  if (!auth) return null
  return auth
}

export async function requireApiKey(req: Request): Promise<ApiKeyRow | null> {
  const raw = bearer(req)
  if (!raw) return null
  return (await resolveApiKey(raw)) ?? null
}

/**
 * Choosing a model spends the tenant's own provider key, so it is a server-side
 * capability: a publishable key sitting in a browser must not reach it.
 */
export async function requireSecretKey(req: Request): Promise<ApiKeyRow | null> {
  const key = await requireApiKey(req)
  return key?.kind === 'secret' ? key : null
}

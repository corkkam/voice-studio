import { getAuth } from '@/lib/auth/session'
import { resolveApiKey } from '@/lib/store/keys'
import { bearer } from '@/lib/api/http'
import type { ApiKeyRow } from '@/lib/store/types'

export async function requireOperator() {
  const auth = await getAuth()
  if (!auth) return null
  return auth
}

export function requireApiKey(req: Request): ApiKeyRow | null {
  const raw = bearer(req)
  if (!raw) return null
  return resolveApiKey(raw) ?? null
}

import { apiError, corsHeaders, json } from '@/lib/api/http'
import { requireSecretKey } from '@/lib/api/guard'
import { PROVIDERS } from '@/lib/models/catalog'
import { listCredentials } from '@/lib/store/credentials'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

/**
 * What this tenant can switch to. Secret key only: the answer says which providers
 * the tenant holds a key for, which is not a browser's business.
 */
export async function GET(req: Request) {
  const key = requireSecretKey(req)
  if (!key) return apiError('A secret key is required.', 401, corsHeaders(req))

  const credentials = listCredentials(key.tenant_id).filter((c) => !c.revoked_at)
  const held = new Set(credentials.map((c) => c.provider))

  return json(
    {
      providers: PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        open: provider.open,
        models: provider.models,
        /** False means add a key under Keys before selecting it. */
        ready: held.has(provider.id) || Boolean(provider.platformKeyEnv && process.env[provider.platformKeyEnv]),
        anyModelId: true,
      })),
      credentials: credentials.map((c) => ({
        id: c.id,
        provider: c.provider,
        label: c.label,
        hint: c.hint,
        lastUsedAt: c.last_used_at,
      })),
    },
    200,
    corsHeaders(req),
  )
}

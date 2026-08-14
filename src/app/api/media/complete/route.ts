import { apiError, bearer, corsHeaders, json, readJson } from '@/lib/api/http'
import { requireSecretKey } from '@/lib/api/guard'
import { getAuth } from '@/lib/auth/session'
import { completeTurn } from '@/lib/media/complete'
import { getCall, resolveSessionToken } from '@/lib/store/calls'
import { parseModelRef, type ModelRef } from '@/lib/models/catalog'
import { ModelRouteError } from '@/lib/models/route'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request) {
  const body = await readJson<{
    sessionId?: string
    token?: string
    text?: string
    model?: unknown
  }>(req)
  const text = body.text?.trim()
  if (!text) return apiError('text is required', 400, corsHeaders(req))

  const auth = await getAuth()
  let call = body.token ? resolveSessionToken(body.token)?.call : undefined
  if (!call && body.sessionId) {
    if (auth) call = getCall(auth.tenant.id, body.sessionId)
    if (!call) {
      const raw = bearer(req)
      if (raw?.startsWith('vst_')) call = resolveSessionToken(raw)?.call
    }
  }
  if (!call || call.status !== 'live') return apiError('Live session not found', 404, corsHeaders(req))

  // A session token proves the session, not the tenant's wallet. Only an operator
  // in the studio or a secret key may aim this turn at a different model.
  const privileged =
    auth?.tenant.id === call.tenant_id || requireSecretKey(req)?.tenant_id === call.tenant_id

  let override: ModelRef | undefined
  if (body.model !== undefined && body.model !== null) {
    if (!privileged) {
      return apiError('A secret key is required to choose a model.', 403, corsHeaders(req))
    }
    override = parseModelRef(body.model)
    if (!override) {
      return apiError('model must be "provider/model" or { provider, model }', 400, corsHeaders(req))
    }
  }

  try {
    const result = await completeTurn(call, text, override)
    return json(
      {
        reply: result.text,
        llmMs: result.llmMs,
        model: result.model,
        provider: result.provider,
        modelSource: result.source,
        fallback: result.fallback,
      },
      200,
      corsHeaders(req),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Completion failed'
    return apiError(message, error instanceof ModelRouteError ? 422 : 502, corsHeaders(req))
  }
}

import { apiError, bearer, corsHeaders, json, readJson } from '@/lib/api/http'
import { requireApiKey, requireSecretKey } from '@/lib/api/guard'
import { endCall, getCall, resolveSessionToken, setCallActivity, setCallModel } from '@/lib/store/calls'
import { parseModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'
import type { CallActivity } from '@/lib/activity'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

function loadCall(req: Request, sessionId: string) {
  const raw = bearer(req)
  if (raw?.startsWith('vst_')) {
    const resolved = resolveSessionToken(raw)
    if (!resolved || resolved.call.id !== sessionId) return null
    return resolved.call
  }
  const key = requireApiKey(req)
  if (!key) return null
  return getCall(key.tenant_id, sessionId) ?? null
}

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const call = loadCall(req, sessionId)
  if (!call) return apiError('Session not found', 404)
  return json(
    {
      id: call.id,
      status: call.status,
      activity: call.activity,
      activityDetail: call.activity_detail,
      channel: call.channel,
      startedAt: call.started_at,
      model: call.model_provider ? `${call.model_provider}/${call.model_name}` : null,
    },
    200,
    corsHeaders(req),
  )
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const call = loadCall(req, sessionId)
  if (!call) return apiError('Session not found', 404)
  const body = await readJson<{ activity?: CallActivity; detail?: string; model?: unknown }>(req)
  if (body.activity) setCallActivity(call, body.activity, body.detail || call.activity_detail)

  let model = call.model_provider ? `${call.model_provider}/${call.model_name}` : null
  if (body.model !== undefined) {
    // Switching mid-call spends the tenant's provider key, so a session token is
    // not enough here even though it is enough to speak a turn.
    const key = requireSecretKey(req)
    if (!key || key.tenant_id !== call.tenant_id) {
      return apiError('A secret key is required to switch the model.', 403)
    }
    if (body.model === null) {
      setCallModel(call, null)
      model = null
    } else {
      const ref = parseModelRef(body.model)
      if (!ref) return apiError('model must be "provider/model" or { provider, model }')
      try {
        assertRoutable(call.tenant_id, ref)
      } catch (error) {
        if (error instanceof ModelRouteError) return apiError(error.message, 422)
        throw error
      }
      setCallModel(call, ref)
      model = `${ref.provider}/${ref.model}`
    }
  }

  return json({ ok: true, model }, 200, corsHeaders(req))
}

export async function DELETE(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const call = loadCall(req, sessionId)
  if (!call) return apiError('Session not found', 404)
  const ended = endCall(call)
  return json({ id: ended.id, status: ended.status }, 200, corsHeaders(req))
}

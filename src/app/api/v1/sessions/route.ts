import { apiError, corsHeaders, json, publicBaseUrl, readJson } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'
import { createCall } from '@/lib/store/calls'
import { getAgentRow } from '@/lib/store/agents'
import { parseModelRef, type ModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'
import type { CallChannel } from '@/lib/store/types'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request) {
  const key = requireApiKey(req)
  if (!key) return apiError('Unauthorized', 401)

  const body = await readJson<{
    agentId?: string
    channel?: CallChannel
    display?: string
    locale?: string
    metadata?: Record<string, unknown>
    model?: unknown
  }>(req)

  if (!body.agentId) return apiError('agentId is required')
  const agent = getAgentRow(key.tenant_id, body.agentId)
  if (!agent) return apiError('Agent not found', 404)
  if (agent.status !== 'live' && key.kind === 'publishable') {
    return apiError('Agent is not published', 409)
  }

  const channel: CallChannel =
    body.channel === 'macos' || body.channel === 'api' || body.channel === 'studio'
      ? body.channel
      : 'web'

  if (key.kind === 'publishable' && channel === 'api') {
    return apiError('Publishable keys cannot open API sessions. Use a secret key.', 403)
  }

  let model: ModelRef | undefined
  if (body.model !== undefined && body.model !== null) {
    if (key.kind !== 'secret') {
      return apiError('Publishable keys cannot choose a model. Use a secret key.', 403)
    }
    model = parseModelRef(body.model)
    if (!model) return apiError('model must be "provider/model" or { provider, model }')
    // Fail here rather than on the first turn, when a caller is already speaking.
    try {
      assertRoutable(key.tenant_id, model)
    } catch (error) {
      if (error instanceof ModelRouteError) return apiError(error.message, 422)
      throw error
    }
  }

  const { call, sessionToken } = createCall({
    tenantId: key.tenant_id,
    agentId: agent.id,
    channel,
    display: body.display,
    locale: body.locale,
    metadata: { ...body.metadata, origin: req.headers.get('origin') },
    model,
  })

  const base = publicBaseUrl(req)
  return json(
    {
      id: call.id,
      token: sessionToken,
      channel: call.channel,
      agent: {
        id: agent.id,
        name: agent.name,
        locale: agent.locale,
        prompt: agent.system_prompt,
        version: agent.version,
        model: agent.model_provider ? `${agent.model_provider}/${agent.model_name}` : null,
      },
      model: model ? `${model.provider}/${model.model}` : null,
      eventsUrl: `${base}/api/v1/sessions/${call.id}/events?token=${encodeURIComponent(sessionToken)}`,
      completeUrl: `${base}/api/media/complete`,
      // The session resource. DELETE ends it, PATCH switches its model mid-call.
      hangupUrl: `${base}/api/v1/sessions/${call.id}`,
    },
    201,
    corsHeaders(req),
  )
}

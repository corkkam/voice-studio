import { apiError, json, publicBaseUrl, readJson } from '@/lib/api/http'
import { getAuth } from '@/lib/auth/session'
import { createCall } from '@/lib/store/calls'
import { getAgentRow } from '@/lib/store/agents'
import { parseModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getAuth()
  if (!auth) return apiError('Unauthorized', 401)
  const body = await readJson<{ agentId?: string; display?: string; model?: unknown }>(req)
  if (!body.agentId) return apiError('agentId is required')
  const agent = getAgentRow(auth.tenant.id, body.agentId)
  if (!agent) return apiError('Agent not found', 404)

  // A studio test can try a model without saving it on the agent.
  const model = body.model ? parseModelRef(body.model) : undefined
  if (body.model && !model) return apiError('Unknown model')
  if (model) {
    try {
      assertRoutable(auth.tenant.id, model)
    } catch (error) {
      if (error instanceof ModelRouteError) return apiError(error.message, 422)
      throw error
    }
  }

  const { call, sessionToken } = createCall({
    tenantId: auth.tenant.id,
    agentId: agent.id,
    channel: 'studio',
    display: body.display || `${auth.user.name} · test`,
    model,
  })
  const base = publicBaseUrl(req)
  return json(
    {
      id: call.id,
      token: sessionToken,
      eventsUrl: `${base}/api/v1/sessions/${call.id}/events?token=${encodeURIComponent(sessionToken)}`,
    },
    201,
  )
}

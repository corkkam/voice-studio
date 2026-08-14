import { corsHeaders, json, apiError, readJson } from '@/lib/api/http'
import { requireApiKey, requireSecretKey } from '@/lib/api/guard'
import { getAgentRow, updateAgent } from '@/lib/store/agents'
import { parsePipeline } from '@/lib/store/types'
import { parseModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const key = requireApiKey(req)
  if (!key) return apiError('Unauthorized', 401, corsHeaders(req))
  const { agentId } = await ctx.params
  const agent = getAgentRow(key.tenant_id, agentId)
  if (!agent) return apiError('Agent not found', 404, corsHeaders(req))
  return json(
    {
      id: agent.id,
      name: agent.name,
      locale: agent.locale,
      status: agent.status,
      summary: agent.summary,
      prompt: agent.system_prompt,
      pipeline: parsePipeline(agent.pipeline_json),
      version: agent.version,
      model: agent.model_provider ? `${agent.model_provider}/${agent.model_name}` : null,
    },
    200,
    corsHeaders(req),
  )
}

/** Changes the agent's default model, so every session opened after this starts on it. */
export async function PATCH(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const key = requireSecretKey(req)
  if (!key) return apiError('A secret key is required.', 401, corsHeaders(req))
  const { agentId } = await ctx.params
  const agent = getAgentRow(key.tenant_id, agentId)
  if (!agent) return apiError('Agent not found', 404, corsHeaders(req))

  const body = await readJson<{ model?: unknown }>(req)
  if (body.model === undefined) return apiError('model is required', 400, corsHeaders(req))

  // null clears the choice and puts the agent back on the platform model.
  if (body.model === null) {
    updateAgent(key.tenant_id, agentId, {
      model_provider: '',
      model_name: '',
      model_credential_id: null,
    })
    return json({ id: agentId, model: null }, 200, corsHeaders(req))
  }

  const ref = parseModelRef(body.model)
  if (!ref) return apiError('model must be "provider/model" or { provider, model }', 400, corsHeaders(req))
  try {
    assertRoutable(key.tenant_id, ref)
  } catch (error) {
    if (error instanceof ModelRouteError) return apiError(error.message, 422, corsHeaders(req))
    throw error
  }
  updateAgent(key.tenant_id, agentId, {
    model_provider: ref.provider,
    model_name: ref.model,
    model_credential_id: ref.credentialId ?? null,
  })
  return json({ id: agentId, model: `${ref.provider}/${ref.model}` }, 200, corsHeaders(req))
}

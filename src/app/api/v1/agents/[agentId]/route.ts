import { corsHeaders, json, apiError } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'
import { getAgentRow } from '@/lib/store/agents'
import { parsePipeline } from '@/lib/store/types'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const key = requireApiKey(req)
  if (!key) return apiError('Unauthorized', 401)
  const { agentId } = await ctx.params
  const agent = getAgentRow(key.tenant_id, agentId)
  if (!agent) return apiError('Agent not found', 404)
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
    },
    200,
    corsHeaders(req),
  )
}

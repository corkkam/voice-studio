import { corsHeaders, json, apiError } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'
import { listAgents } from '@/lib/store/agents'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: Request) {
  getDb()
  const key = requireApiKey(req)
  if (!key) return apiError('Unauthorized', 401, corsHeaders(req))
  const agents = listAgents(key.tenant_id).map((agent) => ({
    id: agent.id,
    name: agent.name,
    locale: agent.locale,
    status: agent.status,
    summary: agent.summary,
    // The LLM slot of the pipeline triple, which is the model this agent runs on.
    model: agent.pipeline[1],
  }))
  return json({ agents }, 200, corsHeaders(req))
}

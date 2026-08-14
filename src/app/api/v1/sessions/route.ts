import { apiError, corsHeaders, json, publicBaseUrl, readJson } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'
import { createCall } from '@/lib/store/calls'
import { getAgentRow } from '@/lib/store/agents'
import { resolveVoice } from '@/lib/store/voices'
import { policyOrEmpty } from '@/lib/store/policies'
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

  const { call, sessionToken } = createCall({
    tenantId: key.tenant_id,
    agentId: agent.id,
    channel,
    display: body.display,
    locale: body.locale,
    metadata: { ...body.metadata, origin: req.headers.get('origin') },
  })

  // Additive fields only. Three SDKs and the widget ship against this shape, so
  // `voice` and `disclosure` are new keys an old client simply ignores.
  const voice = resolveVoice(key.tenant_id, agent.voice_id)
  const policy = policyOrEmpty(key.tenant_id, agent.id)

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
      },
      // The client resolves this against a real device voice. There is no
      // server-side TTS to apply it for them.
      voice: voice
        ? {
            id: voice.id,
            name: voice.name,
            locale: voice.locale,
            familyHint: voice.family_hint,
            rate: voice.rate,
            pitch: voice.pitch,
          }
        : null,
      // Recorded intent. The client must play it; nothing here can enforce that.
      disclosure: policy.disclosure || null,
      eventsUrl: `${base}/api/v1/sessions/${call.id}/events?token=${encodeURIComponent(sessionToken)}`,
      completeUrl: `${base}/api/media/complete`,
      hangupUrl: `${base}/api/v1/sessions/${call.id}`,
    },
    201,
    corsHeaders(req),
  )
}

import { apiError, bearer, corsHeaders, json, readJson } from '@/lib/api/http'
import { getAuth } from '@/lib/auth/session'
import { completeTurn } from '@/lib/media/complete'
import { getCall, resolveSessionToken } from '@/lib/store/calls'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: Request) {
  const body = await readJson<{ sessionId?: string; token?: string; text?: string }>(req)
  const text = body.text?.trim()
  if (!text) return apiError('text is required')

  let call = body.token ? resolveSessionToken(body.token)?.call : undefined
  if (!call && body.sessionId) {
    const auth = await getAuth()
    if (auth) call = getCall(auth.tenant.id, body.sessionId)
    if (!call) {
      const raw = bearer(req)
      if (raw?.startsWith('vst_')) call = resolveSessionToken(raw)?.call
    }
  }
  if (!call || call.status !== 'live') return apiError('Live session not found', 404)

  try {
    const result = await completeTurn(call, text)
    return json({ reply: result.text, llmMs: result.llmMs, model: result.model, fallback: result.fallback }, 200, corsHeaders(req))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Completion failed'
    return apiError(message, 502)
  }
}

import { apiError, bearer, corsHeaders, json, readJson } from '@/lib/api/http'
import { requireApiKey } from '@/lib/api/guard'
import { endCall, getCall, resolveSessionToken, setCallActivity } from '@/lib/store/calls'
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
    },
    200,
    corsHeaders(req),
  )
}

export async function PATCH(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const call = loadCall(req, sessionId)
  if (!call) return apiError('Session not found', 404)
  const body = await readJson<{ activity?: CallActivity; detail?: string }>(req)
  if (body.activity) setCallActivity(call, body.activity, body.detail || call.activity_detail)
  return json({ ok: true }, 200, corsHeaders(req))
}

export async function DELETE(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const call = loadCall(req, sessionId)
  if (!call) return apiError('Session not found', 404)
  const ended = endCall(call)
  return json({ id: ended.id, status: ended.status }, 200, corsHeaders(req))
}

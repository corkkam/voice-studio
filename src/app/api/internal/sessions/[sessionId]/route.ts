import { apiError, json } from '@/lib/api/http'
import { getAuth } from '@/lib/auth/session'
import { endCall, getCall } from '@/lib/store/calls'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const auth = await getAuth()
  if (!auth) return apiError('Unauthorized', 401)
  const { sessionId } = await ctx.params
  const call = getCall(auth.tenant.id, sessionId)
  if (!call) return apiError('Session not found', 404)
  const ended = endCall(call)
  return json({ id: ended.id, status: ended.status })
}

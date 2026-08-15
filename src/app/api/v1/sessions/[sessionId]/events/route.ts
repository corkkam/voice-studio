import { apiError, corsHeaders } from '@/lib/api/http'
import { listTurns, resolveSessionToken } from '@/lib/store/calls'
import { subscribe } from '@/lib/realtime/hub'

export const runtime = 'nodejs'

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params
  const url = new URL(req.url)
  const raw = url.searchParams.get('token') || ''
  const resolved = resolveSessionToken(raw)
  if (!resolved || resolved.call.id !== sessionId) return apiError('Unauthorized', 401)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      send({
        type: 'session',
        id: resolved.call.id,
        status: resolved.call.status,
        activity: resolved.call.activity,
        turns: listTurns(resolved.call.id).map((turn) => ({
          seq: turn.seq,
          speaker: turn.speaker,
          text: turn.text,
          atMs: turn.at_ms,
        })),
      })
      const unsub = subscribe(resolved.tenantId, (event) => {
        if (!('callId' in event) || event.callId !== sessionId) return
        send({
          type: event.type,
          id: sessionId,
          turns: listTurns(sessionId).map((turn) => ({
            seq: turn.seq,
            speaker: turn.speaker,
            text: turn.text,
            atMs: turn.at_ms,
          })),
        })
      })
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000)
      const abort = () => {
        clearInterval(ping)
        unsub()
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      req.signal.addEventListener('abort', abort)
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

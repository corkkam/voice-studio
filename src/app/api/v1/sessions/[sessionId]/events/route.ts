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
  const resolved = await resolveSessionToken(raw)
  if (!resolved || resolved.call.id !== sessionId) return apiError('Unauthorized', 401)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      const send = (payload: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      // Reading the turns is a database round trip, so each frame is assembled
      // before it is enqueued. A frame carries the whole turn list, so a later
      // one simply replaces an earlier one on the client.
      const turnLines = async () =>
        (await listTurns(sessionId)).map((turn) => ({
          seq: turn.seq,
          speaker: turn.speaker,
          text: turn.text,
          atMs: turn.at_ms,
        }))
      // A rejected query here has nobody to return it to, and an unhandled
      // rejection takes the whole server down. The stream stays open and the
      // next event tries again.
      const failed = (error: unknown) => console.error('session events failed', error)
      turnLines()
        .then((turns) =>
          send({
            type: 'session',
            id: resolved.call.id,
            status: resolved.call.status,
            activity: resolved.call.activity,
            turns,
          }),
        )
        .catch(failed)
      const unsub = subscribe(resolved.tenantId, (event) => {
        if (!('callId' in event) || event.callId !== sessionId) return
        turnLines()
          .then((turns) => send({ type: event.type, id: sessionId, turns }))
          .catch(failed)
      })
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000)
      const abort = () => {
        closed = true
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

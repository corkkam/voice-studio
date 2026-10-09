import { getAuth } from '@/lib/auth/session'
import { getSnapshot } from '@/lib/store/calls'
import { subscribe } from '@/lib/realtime/hub'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await getAuth()
  if (!auth) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      /*
       * The snapshot is a database round trip now, so a hub event and the first
       * frame can be in flight together. Each enqueue is one whole SSE frame and
       * the client replaces its state wholesale, so an overtaking frame is stale
       * data at worst, never a torn one. `closed` keeps a late frame from
       * enqueueing after abort, which throws.
       */
      const send = () => {
        getSnapshot(auth.tenant.id)
          .then((snapshot) => {
            if (closed) return
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`))
          })
          // A rejected query here has nobody to return it to, and an unhandled
          // rejection takes the whole server down. The stream stays open and the
          // next event tries again.
          .catch((error) => console.error('live snapshot failed', error))
      }
      send()
      const unsub = subscribe(auth.tenant.id, send)
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

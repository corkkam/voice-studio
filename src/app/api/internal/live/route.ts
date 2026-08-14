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
      const send = () => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(getSnapshot(auth.tenant.id))}\n\n`))
      }
      send()
      const unsub = subscribe(auth.tenant.id, send)
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

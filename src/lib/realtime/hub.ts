import 'server-only'

export type HubEvent =
  | { type: 'snapshot' }
  | { type: 'call.upsert'; callId: string }
  | { type: 'call.ended'; callId: string }
  | { type: 'turn'; callId: string }

type Listener = (event: HubEvent) => void

const listeners = new Map<string, Set<Listener>>()

export function publish(tenantId: string, event: HubEvent): void {
  const set = listeners.get(tenantId)
  if (!set) return
  for (const listener of set) {
    try {
      listener(event)
    } catch {
      // a dead subscriber should not take the hub down
    }
  }
}

export function subscribe(tenantId: string, listener: Listener): () => void {
  let set = listeners.get(tenantId)
  if (!set) {
    set = new Set()
    listeners.set(tenantId, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set && set.size === 0) listeners.delete(tenantId)
  }
}

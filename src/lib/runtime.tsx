'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { EndedCall, LiveCall } from '@/lib/data/calls'

export interface Workspace {
  tenantId: string
  tenant: string
  region: string
  initials: string
  userName: string
  email: string
  date: string
}

export interface LiveSnapshot {
  live: LiveCall[]
  ended: EndedCall[]
  liveCount: number
}

interface RuntimeState extends LiveSnapshot {
  workspace: Workspace
  capacity: number
  util: number
  connected: boolean
  scaleBy: (delta: number) => void
}

const RuntimeContext = createContext<RuntimeState | null>(null)

const MIN_CAPACITY = 80
const MAX_CAPACITY = 8000

export function RuntimeProvider({
  workspace,
  initial,
  children,
}: {
  workspace: Workspace
  initial: LiveSnapshot
  children: React.ReactNode
}) {
  const [capacity, setCapacity] = useState(1600)
  const [live, setLive] = useState(initial.live)
  const [ended, setEnded] = useState(initial.ended)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource('/api/internal/live')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as LiveSnapshot & { type?: string }
        if (payload.live) setLive(payload.live)
        if (payload.ended) setEnded(payload.ended)
      } catch {
        // ignore malformed frames
      }
    }
    return () => source.close()
  }, [])

  const value = useMemo<RuntimeState>(() => {
    const liveCount = live.length
    return {
      workspace,
      live,
      ended,
      liveCount,
      capacity,
      connected,
      util: Math.min(100, Math.round((liveCount / capacity) * 100)),
      scaleBy: (delta) =>
        setCapacity((c) => Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY, c + delta))),
    }
  }, [workspace, live, ended, capacity, connected])

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

function useRuntime(): RuntimeState {
  const ctx = useContext(RuntimeContext)
  if (!ctx) throw new Error('useRuntime must be used inside <RuntimeProvider>')
  return ctx
}

export function useWorkspace(): Workspace {
  return useRuntime().workspace
}

export function useLiveFeed(): LiveSnapshot & { connected: boolean } {
  const runtime = useRuntime()
  return {
    live: runtime.live,
    ended: runtime.ended,
    liveCount: runtime.liveCount,
    connected: runtime.connected,
  }
}

export function useFleet() {
  const runtime = useRuntime()
  return {
    active: runtime.liveCount,
    capacity: runtime.capacity,
    util: runtime.util,
    scaleBy: runtime.scaleBy,
  }
}

export function utilColor(util: number): string {
  if (util >= 90) return 'var(--color-accent)'
  if (util >= 75) return '#e0a33f'
  return 'var(--color-ops-good)'
}

export function utilTextClass(util: number): string {
  if (util >= 90) return 'text-accent'
  if (util >= 75) return 'text-[#e0a33f]'
  return 'text-ops-good'
}



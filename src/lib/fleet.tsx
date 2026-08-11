'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { TOTAL_LIVE } from '@/lib/data/callStore'

interface FleetState {
  /** Calls in flight right now. */
  active: number
  /** Sessions the media plane is allowed to hold. */
  capacity: number
  /** Percent of the pool consumed, clamped. */
  util: number
  scaleBy: (delta: number) => void
}

const FleetContext = createContext<FleetState | null>(null)

const MIN_CAPACITY = 80
const MAX_CAPACITY = 8000

/**
 * One source of truth for fleet size across the ops shell.
 *
 * The nav's concurrency meter and the monitor's capacity control were reading
 * two different numbers, which is exactly the bug that makes an operator
 * distrust the dashboard during an incident. Both now read this.
 */
export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [capacity, setCapacity] = useState(1600)
  const active = TOTAL_LIVE

  const value = useMemo<FleetState>(
    () => ({
      active,
      capacity,
      util: Math.min(100, Math.round((active / capacity) * 100)),
      scaleBy: (delta) =>
        setCapacity((c) => Math.max(MIN_CAPACITY, Math.min(MAX_CAPACITY, c + delta))),
    }),
    [active, capacity],
  )

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet(): FleetState {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used inside <FleetProvider>')
  return ctx
}

/** Utilisation colour ramp — amber before red, so scaling up beats queuing. */
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

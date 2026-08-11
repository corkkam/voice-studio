'use client'

import { ThinkingOrb } from 'thinking-orbs'
import { ACTIVITY, type CallActivity } from '@/lib/activity'

/**
 * The single place a live agent is visualised.
 *
 * thinking-orbs is strictly monochrome by design — light ink on dark
 * substrates, dark ink on light ones — and resolves that from the nearest
 * `data-theme` ancestor, which the two shells already set. So the orb is left
 * on `theme="auto"` rather than being tinted to the studio's orange: the
 * accent stays reserved for numbers that breached a budget, and the orb never
 * competes with them for attention.
 */
export function AgentOrb({
  activity,
  size = 64,
  paused = false,
  className,
}: {
  activity: CallActivity
  size?: 64 | 20
  paused?: boolean
  className?: string
}) {
  const view = ACTIVITY[activity]
  return (
    <ThinkingOrb
      state={view.orb}
      size={size}
      speed={view.speed}
      paused={paused}
      aria-label={view.aria}
      className={className}
    />
  )
}

/**
 * The whole fleet as one orb, for aggregate tiles that summarise every call at
 * once rather than a single pipeline. `working` — particles on tilted orbits —
 * is the only state that reads as "many things in flight" instead of naming
 * one stage.
 */
export function FleetOrb({
  size = 64,
  concurrency,
}: {
  size?: 64 | 20
  concurrency: number
}) {
  return (
    <ThinkingOrb
      state="working"
      size={size}
      speed={1.1}
      aria-label={`${concurrency} calls in flight`}
    />
  )
}

/** Orb plus its label — the standard pairing on the live monitor cards. */
export function AgentOrbStatus({
  activity,
  size = 64,
  paused = false,
  tone = 'ops',
  detail,
}: {
  activity: CallActivity
  size?: 64 | 20
  paused?: boolean
  tone?: 'ops' | 'paper'
  detail?: string
}) {
  const view = ACTIVITY[activity]
  const labelColor = tone === 'ops' ? 'text-ops-ink-3' : 'text-ink-2'
  const detailColor = tone === 'ops' ? 'text-ops-muted-3' : 'text-muted-2'

  return (
    <div className="flex items-center gap-3">
      <AgentOrb activity={activity} size={size} paused={paused} />
      <div className="min-w-0">
        <div className={`font-sans text-[11.5px] leading-none font-semibold ${labelColor}`}>
          {view.label}
        </div>
        {detail ? (
          <div className={`mt-[5px] font-mono text-[10px] leading-none ${detailColor}`}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  )
}

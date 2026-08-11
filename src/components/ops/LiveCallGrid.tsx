'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AgentOrbStatus } from '@/components/orb/AgentOrb'
import type { CallActivity } from '@/lib/activity'
import { formatElapsed, type LiveCall } from '@/lib/data/calls'
import { countCalls, sliceCalls, type CallFilter } from '@/lib/data/callStore'
import { useVirtualGrid } from '@/lib/useVirtualGrid'

const CARD_HEIGHT = 288
const MIN_CARD_WIDTH = 316
const GAP = 14

/**
 * Beyond this many cards on screen at once the live orbs are swapped for a
 * static frame. Each orb is a real 2D-canvas animation; the library already
 * pauses offscreen instances, but a 4K wallboard can legitimately hold 40+
 * cards *on* screen, and forty simultaneous animations buys nothing an
 * operator can actually read. The state still shows — it just stops moving.
 */
const LIVE_ORB_BUDGET = 24

const HELD: CallActivity[] = ['recovering', 'transferring']
const CYCLE: CallActivity[] = ['listening', 'thinking', 'speaking']

function advance(current: CallActivity, tick: number, seed: number): CallActivity {
  if (HELD.includes(current)) return current
  return CYCLE[Math.floor((tick + seed) / 3) % CYCLE.length]
}

export type FilterKey = 'all' | 'slow' | 'negative'

export function LiveCallGrid({
  filterKey,
  onCounts,
}: {
  filterKey: FilterKey
  onCounts?: (counts: { total: number; slow: number; negative: number }) => void
}) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const filter: CallFilter | undefined = useMemo(() => {
    if (filterKey === 'slow') return { minV2vMs: 900 }
    if (filterKey === 'negative') return { negativeSentiment: true }
    return undefined
  }, [filterKey])

  const counts = useMemo(
    () => ({
      total: countCalls(),
      slow: countCalls({ minV2vMs: 900 }),
      negative: countCalls({ negativeSentiment: true }),
    }),
    [],
  )

  useEffect(() => {
    onCounts?.(counts)
  }, [counts, onCounts])

  const count =
    filterKey === 'slow' ? counts.slow : filterKey === 'negative' ? counts.negative : counts.total

  const grid = useVirtualGrid({
    count,
    minColumnWidth: MIN_CARD_WIDTH,
    rowHeight: CARD_HEIGHT,
    gap: GAP,
  })

  // Only the visible window is ever materialised.
  const calls = useMemo(() => {
    if (!grid.visible.length) return []
    const offset = grid.visible[0]
    return sliceCalls(offset, grid.visible.length, filter)
  }, [grid.visible, filter])

  const animateOrbs = calls.length <= LIVE_ORB_BUDGET

  return (
    <div ref={grid.scrollRef} className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">
      <div style={{ height: grid.totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${grid.offsetY}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
            gap: GAP,
          }}
        >
          {calls.map((call, i) => (
            <CallCard
              key={call.id}
              call={call}
              tick={tick}
              seed={(grid.visible[0] + i) * 2}
              animate={animateOrbs}
            />
          ))}
        </div>
      </div>

      {count === 0 ? (
        <div className="py-16 text-center font-sans text-[12.5px] text-ops-muted-2">
          No calls match this filter right now.
        </div>
      ) : null}
    </div>
  )
}

function CallCard({
  call,
  tick,
  seed,
  animate,
}: {
  call: LiveCall
  tick: number
  seed: number
  animate: boolean
}) {
  const activity = advance(call.activity, tick, seed)
  const elapsed = call.elapsedSec + tick
  const over = call.v2vMs > 900

  return (
    <article
      style={{ height: CARD_HEIGHT }}
      className={`flex flex-col overflow-hidden rounded-[10px] p-[14px] ${
        call.alert
          ? 'border border-ops-alert-line bg-ops-alert-panel'
          : 'border border-ops-line bg-ops-panel'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate font-mono text-[13.5px] leading-none font-semibold text-ops-ink">
            {call.display}
          </div>
          <div className="mt-[5px] truncate font-sans text-[11px] leading-none text-ops-muted-2">
            {call.agent} · {call.locale}
          </div>
        </div>
        <div className="flex-none pl-2 text-right">
          <div className="font-mono text-[12px] leading-none font-semibold text-ops-ink">
            {formatElapsed(elapsed)}
          </div>
          <div
            className={`mt-[5px] font-mono text-[10px] leading-none font-medium ${
              over ? 'text-accent' : 'text-ops-good'
            }`}
          >
            {call.v2vMs.toLocaleString('en-US')} ms
          </div>
        </div>
      </div>

      {/* Was a bar waveform; the orb names the pipeline stage instead. */}
      <div className="my-3 flex h-[64px] flex-none items-center">
        <AgentOrbStatus
          activity={activity}
          size={64}
          paused={!animate}
          detail={call.activityDetail}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[7px] overflow-hidden">
        {call.lines.map((line) => (
          <div key={line.at} className="grid grid-cols-[34px_1fr] gap-2">
            <span className="font-mono text-[9.5px] leading-[1.5] font-medium text-ops-muted-3">
              {line.at}
            </span>
            <span
              className={`line-clamp-2 font-sans text-[11.5px] leading-[1.5] ${
                line.tone === 'alert'
                  ? 'text-accent-soft'
                  : line.tone === 'current'
                    ? 'text-ops-ink-2'
                    : 'text-ops-muted'
              }`}
            >
              {line.text}
            </span>
          </div>
        ))}

        <div className="flex flex-wrap gap-[5px]">
          {call.chips.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-[4px] px-[6px] py-[5px] font-mono text-[9.5px] leading-none ${
                chip.tone === 'alert'
                  ? 'bg-accent font-semibold text-ops-bg'
                  : chip.tone === 'muted'
                    ? 'bg-ops-raised font-medium text-ops-muted-3'
                    : 'bg-ops-raised font-medium text-ops-ink-3'
              }`}
            >
              {chip.label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex justify-between gap-2 font-mono text-[10px] leading-none font-medium text-ops-muted-3">
          <span className="truncate">{call.footLeft}</span>
          <span
            className={`flex-none ${call.footTone === 'alert' ? 'text-accent' : 'text-ops-good'}`}
          >
            {call.footRight}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-none gap-[6px]">
        {call.actions.map((action, i) =>
          i === 2 ? (
            <button
              key={action}
              type="button"
              className="flex-1 rounded-[6px] bg-accent py-[7px] text-center font-sans text-[11px] leading-none font-semibold text-ops-bg"
            >
              {action}
            </button>
          ) : (
            <Link
              key={action}
              href={`/calls/${call.id}`}
              className="flex-1 rounded-[6px] border border-ops-line py-[7px] text-center font-sans text-[11px] leading-none font-semibold text-ops-ink-3 hover:bg-ops-raised"
            >
              {action}
            </Link>
          ),
        )}
      </div>
    </article>
  )
}

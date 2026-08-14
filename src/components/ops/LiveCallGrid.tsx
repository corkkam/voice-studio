'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { AgentOrbStatus } from '@/components/orb/AgentOrb'
import { formatElapsed, type LiveCall } from '@/lib/data/calls'
import { useLiveFeed } from '@/lib/runtime'
import { useVirtualGrid } from '@/lib/useVirtualGrid'

const CARD_HEIGHT = 288
const MIN_CARD_WIDTH = 316
const GAP = 14
const LIVE_ORB_BUDGET = 24

export type FilterKey = 'all' | 'slow' | 'negative'

export function LiveCallGrid({
  filterKey,
  onCounts,
}: {
  filterKey: FilterKey
  onCounts?: (counts: { total: number; slow: number; negative: number }) => void
}) {
  const { live } = useLiveFeed()
  const filtered = live.filter((call) => {
    if (filterKey === 'slow') return call.v2vMs > 900
    if (filterKey === 'negative') return call.footTone === 'alert'
    return true
  })

  const counts = {
    total: live.length,
    slow: live.filter((c) => c.v2vMs > 900).length,
    negative: live.filter((c) => c.footTone === 'alert').length,
  }

  useEffect(() => {
    onCounts?.(counts)
  }, [counts.total, counts.slow, counts.negative, onCounts])

  const grid = useVirtualGrid({
    count: filtered.length,
    minColumnWidth: MIN_CARD_WIDTH,
    rowHeight: CARD_HEIGHT,
    gap: GAP,
  })

  const windowed = grid.visible.map((i) => filtered[i]).filter(Boolean) as LiveCall[]
  const animateOrbs = windowed.length <= LIVE_ORB_BUDGET

  if (filtered.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[22px] py-[18px]">
        <div className="max-w-[420px] text-center">
          <div className="font-sans text-[14px] font-semibold text-ops-ink">No live sessions</div>
          <p className="mt-2 font-sans text-[12.5px] leading-[1.5] text-ops-muted-2">
            Start a studio test call, or connect a web or Mac client with an API key. Sessions appear
            here the moment they open.
          </p>
        </div>
      </div>
    )
  }

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
          {windowed.map((call) => (
            <CallCard key={call.id} call={call} animate={animateOrbs} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CallCard({ call, animate }: { call: LiveCall; animate: boolean }) {
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
            {formatElapsed(call.elapsedSec)}
          </div>
          <div className={`mt-[5px] font-mono text-[10px] leading-none font-medium ${over ? 'text-accent' : 'text-ops-good'}`}>
            {call.v2vMs ? `${call.v2vMs.toLocaleString('en-US')} ms` : '—'}
          </div>
        </div>
      </div>

      <div className="my-3 flex h-[64px] flex-none items-center">
        <AgentOrbStatus activity={call.activity} size={64} paused={!animate} detail={call.activityDetail} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[7px] overflow-hidden">
        {call.lines.map((line) => (
          <div key={`${line.at}-${line.text}`} className="grid grid-cols-[34px_1fr] gap-2">
            <span className="font-mono text-[9.5px] leading-[1.5] font-medium text-ops-muted-3">{line.at}</span>
            <span
              className={`line-clamp-2 font-sans text-[11.5px] leading-[1.5] ${
                line.tone === 'current' ? 'text-ops-ink-2' : 'text-ops-muted'
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
              className="rounded-[4px] bg-ops-raised px-[6px] py-[5px] font-mono text-[9.5px] font-medium text-ops-ink-3"
            >
              {chip.label}
            </span>
          ))}
        </div>
        <div className="mt-auto flex justify-between gap-2 font-mono text-[10px] font-medium text-ops-muted-3">
          <span className="truncate">{call.footLeft}</span>
          <span className={`flex-none ${call.footTone === 'alert' ? 'text-accent' : 'text-ops-good'}`}>
            {call.footRight}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-none gap-[6px]">
        <Link
          href={`/calls/${call.id}`}
          className="flex-1 rounded-[6px] border border-ops-line py-[7px] text-center font-sans text-[11px] font-semibold text-ops-ink-3 hover:bg-ops-raised"
        >
          Open
        </Link>
        <HangupButton callId={call.id} />
      </div>
    </article>
  )
}

function HangupButton({ callId }: { callId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void fetch(`/api/internal/sessions/${callId}`, { method: 'DELETE' })
      }}
      className="flex-1 rounded-[6px] bg-accent py-[7px] text-center font-sans text-[11px] font-semibold text-ops-bg"
    >
      Hang up
    </button>
  )
}

'use client'

import type { FilterKey } from '@/components/ops/LiveCallGrid'
import { useFleet, utilColor, utilTextClass } from '@/lib/fleet'

/**
 * Concurrency pool sizing, in the operator's hands.
 *
 * Capacity is the one lever that matters when the fleet is saturated, so it is
 * a control on the monitor rather than a number buried in settings. Stepping it
 * changes the pool the media plane is allowed to fill; the utilisation bar goes
 * amber before it goes red so the operator scales up *before* calls queue.
 */
function CapacityControl() {
  const { active, capacity, util, scaleBy } = useFleet()

  return (
    <div className="flex items-center gap-[10px] rounded-[6px] border border-ops-line bg-ops-panel-2 px-[10px] py-[6px]">
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-baseline gap-[6px] font-mono text-[10.5px] leading-none font-medium text-ops-muted-2">
          <span>POOL</span>
          <span className="text-ops-ink">
            {active.toLocaleString('en-US')}
            <span className="text-ops-faint">/{capacity.toLocaleString('en-US')}</span>
          </span>
          <span className={utilTextClass(util)}>{util}%</span>
        </div>
        <div className="h-[3px] w-[140px] overflow-hidden rounded-[2px] bg-ops-line">
          <div
            className="h-full rounded-[2px] transition-[width] duration-300"
            style={{ width: `${util}%`, background: utilColor(util) }}
          />
        </div>
      </div>
      <div className="flex gap-[3px]">
        <button
          type="button"
          onClick={() => scaleBy(-160)}
          aria-label="Scale the concurrency pool down"
          className="h-[22px] w-[22px] rounded-[4px] border border-ops-line font-mono text-[12px] leading-none text-ops-ink-3 hover:bg-ops-raised"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => scaleBy(160)}
          aria-label="Scale the concurrency pool up"
          className="h-[22px] w-[22px] rounded-[4px] border border-ops-line font-mono text-[12px] leading-none text-ops-ink-3 hover:bg-ops-raised"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function MonitorHeader({
  filterKey,
  onFilter,
  counts,
}: {
  filterKey: FilterKey
  onFilter: (key: FilterKey) => void
  counts: { total: number; slow: number; negative: number }
}) {
  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All agents · ${counts.total.toLocaleString('en-US')}` },
    { key: 'slow', label: `Latency > 900 ms · ${counts.slow.toLocaleString('en-US')}` },
    { key: 'negative', label: `Sentiment ↓ · ${counts.negative.toLocaleString('en-US')}` },
  ]

  return (
    <header className="flex min-h-[56px] flex-none flex-wrap items-center gap-x-[14px] gap-y-2 border-b border-ops-line px-[22px] py-[10px]">
      <div>
        <h1 className="font-sans text-[15px] leading-none font-semibold text-ops-ink">
          Live calls
        </h1>
        <p className="mt-1 font-sans text-[11px] leading-none text-ops-muted-2">
          Collections — Aug W2 · 9:00–18:00 IST window
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-[7px]">
        <CapacityControl />

        {filters.map((f) => {
          const active = filterKey === f.key
          const alert = f.key !== 'all'
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilter(f.key)}
              aria-pressed={active}
              className={`rounded-[5px] border px-[9px] py-[6px] font-mono text-[10.5px] leading-none font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent text-ops-bg'
                  : alert
                    ? 'border-ops-alert-line bg-ops-alert-bg text-ops-ink hover:border-accent'
                    : 'border-ops-line text-ops-muted-2 hover:text-ops-ink'
              }`}
            >
              {f.label}
            </button>
          )
        })}

        <button
          type="button"
          className="rounded-[5px] bg-accent px-[11px] py-[7px] font-sans text-[11px] leading-none font-semibold text-ops-bg"
        >
          Pause dialer
        </button>
      </div>
    </header>
  )
}

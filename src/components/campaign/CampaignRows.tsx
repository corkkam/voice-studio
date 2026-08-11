'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { TOTAL_ROWS, sliceCampaignRows } from '@/lib/data/campaign'
import { useVirtualGrid } from '@/lib/useVirtualGrid'

const ROW_HEIGHT = 42
const COLS = 'grid grid-cols-[1.1fr_1fr_0.9fr_0.8fr_1fr] gap-3 px-4 items-center'

/**
 * The dialed list — 18,204 rows, windowed.
 *
 * Rendering the whole table would put ~90,000 cells in the DOM and lock the
 * tab for seconds on every scroll. The window keeps it at roughly one screen's
 * worth no matter how large the campaign gets.
 */
export function CampaignRows() {
  const grid = useVirtualGrid({
    count: TOTAL_ROWS,
    minColumnWidth: 10_000, // force a single column — this is a list, not a grid
    maxColumns: 1,
    rowHeight: ROW_HEIGHT,
    gap: 0,
    overscanRows: 6,
  })

  const rows = useMemo(() => {
    if (!grid.visible.length) return []
    return sliceCampaignRows(grid.visible[0], grid.visible.length)
  }, [grid.visible])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-panel">
      <div
        className={`${COLS} flex-none border-b border-line-3 bg-panel-2 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
      >
        <div>NUMBER</div>
        <div>BUCKET</div>
        <div>ATTEMPT</div>
        <div>V2V</div>
        <div className="flex justify-between">
          <span>OUTCOME</span>
          <span className="tracking-normal text-muted-3">
            {TOTAL_ROWS.toLocaleString('en-IN')} dialed
          </span>
        </div>
      </div>

      <div ref={grid.scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: grid.totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${grid.offsetY}px)` }}>
            {rows.map((row, i) => {
              const body = (
                <>
                  <div className="truncate">{row.number}</div>
                  <div className="truncate font-sans text-ink-3">{row.bucket}</div>
                  <div>{row.attempt}</div>
                  <div className={row.v2vOver ? 'text-accent-deep' : undefined}>{row.v2v}</div>
                  <div
                    className={`truncate font-sans ${
                      row.outcomeTone === 'good'
                        ? 'font-semibold text-good-deep'
                        : 'text-ink-3'
                    }`}
                  >
                    {row.outcome}
                  </div>
                </>
              )

              const className = `${COLS} border-b border-line-5 font-mono text-[11.5px] leading-none font-medium text-ink-2 hover:bg-panel-2`

              return row.callId ? (
                <Link
                  key={`${row.number}-${grid.visible[0] + i}`}
                  href={`/calls/${row.callId}`}
                  style={{ height: ROW_HEIGHT }}
                  className={className}
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={`${row.number}-${grid.visible[0] + i}`}
                  style={{ height: ROW_HEIGHT }}
                  className={className}
                >
                  {body}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

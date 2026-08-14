'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLiveFeed } from '@/lib/runtime'

const COLS = 'grid grid-cols-[1.1fr_1.3fr_0.7fr_0.7fr_0.7fr_1.2fr] gap-3 px-[14px] items-center'

export function EndedCallsStrip() {
  const [open, setOpen] = useState(true)
  const { ended } = useLiveFeed()

  return (
    <section className="flex-none border-t border-ops-line bg-ops-panel-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${COLS} w-full border-b border-ops-line-2 py-[9px] text-left font-mono text-[9.5px] font-semibold tracking-[0.07em] text-ops-muted-3 hover:text-ops-ink-3`}
      >
        <div>
          {open ? '▾' : '▸'} ENDED · {ended.length}
        </div>
        <div>AGENT</div>
        <div>DUR</div>
        <div>V2V</div>
        <div>BARGE</div>
        <div>OUTCOME</div>
      </button>

      {open ? (
        <div className="max-h-[188px] overflow-y-auto">
          {ended.length === 0 ? (
            <div className="px-[14px] py-6 font-sans text-[12px] text-ops-muted-2">No ended sessions yet.</div>
          ) : (
            ended.map((call, i) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className={`${COLS} py-[10px] font-mono text-[11px] font-medium text-ops-ink-3 hover:bg-ops-raised ${
                  i < ended.length - 1 ? 'border-b border-ops-line-2' : ''
                }`}
              >
                <div className="truncate">{call.number}</div>
                <div className="truncate font-sans text-ops-muted">{call.agent}</div>
                <div>{call.duration}</div>
                <div className={call.v2vOver ? 'text-accent-soft' : undefined}>{call.v2v}</div>
                <div>{call.barge}</div>
                <div
                  className={`truncate font-sans ${
                    call.outcomeTone === 'good' ? 'font-semibold text-ops-good-2' : 'text-ops-muted'
                  }`}
                >
                  {call.outcome}
                </div>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}

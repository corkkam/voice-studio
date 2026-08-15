import Link from 'next/link'
import type { CampaignRow } from '@/lib/data/campaign'

const COLS = 'grid grid-cols-[1.1fr_1fr_0.9fr_0.8fr_1fr] gap-3 px-4 items-center'

export function CampaignRows({ rows }: { rows: CampaignRow[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-line bg-panel">
      <div
        className={`${COLS} flex-none border-b border-line-3 bg-panel-2 py-[10px] font-mono text-[9.5px] font-semibold tracking-[0.07em] text-muted-4`}
      >
        <div>NUMBER</div>
        <div>BUCKET</div>
        <div>ATTEMPT</div>
        <div>V2V</div>
        <div>OUTCOME</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center font-sans text-[12.5px] text-muted">
          No dialed rows. The list fills when a licensed carrier is attached.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => {
            const body = (
              <>
                <div className="truncate">{row.number}</div>
                <div className="truncate font-sans text-ink-3">{row.bucket}</div>
                <div>{row.attempt}</div>
                <div className={row.v2vOver ? 'text-accent-deep' : undefined}>{row.v2v}</div>
                <div className={`truncate font-sans ${row.outcomeTone === 'good' ? 'font-semibold text-good-deep' : 'text-ink-3'}`}>
                  {row.outcome}
                </div>
              </>
            )
            const className = `${COLS} h-[42px] border-b border-line-5 font-mono text-[11.5px] font-medium text-ink-2 hover:bg-panel-2`
            return row.callId ? (
              <Link key={row.number} href={`/calls/${row.callId}`} className={className}>
                {body}
              </Link>
            ) : (
              <div key={row.number} className={className}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

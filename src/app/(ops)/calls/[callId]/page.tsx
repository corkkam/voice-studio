import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Eyebrow } from '@/components/ui/primitives'
import { requireAuth } from '@/lib/auth/session'
import { getCall, listTurns } from '@/lib/store/calls'
import { getAgentById } from '@/lib/store/agents'
import { formatElapsed } from '@/lib/data/calls'

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>
}) {
  const auth = await requireAuth()
  const { callId } = await params
  const call = getCall(auth.tenant.id, callId)
  if (!call) notFound()
  const agent = getAgentById(call.agent_id)
  const turns = listTurns(call.id)
  const durationSec = Math.max(
    0,
    Math.floor(((call.ended_at ?? Date.now()) - call.started_at) / 1000),
  )

  return (
    <>
      <header className="flex min-h-[64px] flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-ops-line px-[22px] py-[10px]">
        <div className="font-sans text-[12px] font-medium text-ops-muted-2">
          <Link href="/calls" className="text-ops-ink-3 hover:text-ops-ink">
            ← Calls
          </Link>
          <span className="mx-[7px] text-ops-faint-3">/</span>
          <span className="font-mono text-[12px] font-semibold text-ops-ink">{callId}</span>
        </div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <span className="rounded-[5px] border border-ops-line bg-ops-raised px-2 py-[5px] font-mono text-[10.5px] font-medium text-ops-ink">
            {call.display}
          </span>
          <span className="font-mono text-[10.5px] text-ops-muted-2">{formatElapsed(durationSec)}</span>
          <span className="rounded-[5px] border border-ops-good-line bg-ops-good-bg px-2 py-[5px] font-mono text-[10.5px] font-medium text-ops-good-2">
            {call.status} · {call.channel}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_420px]">
        <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto px-[22px] py-[18px]">
          <Eyebrow tone="ops">TRANSCRIPT · {agent?.name ?? 'agent'}</Eyebrow>
          {turns.length === 0 ? (
            <p className="font-sans text-[13px] text-ops-muted-2">No turns recorded on this session.</p>
          ) : (
            <div className="flex flex-col gap-[13px]">
              {turns.map((turn) => (
                <div key={turn.id} className="grid grid-cols-[52px_1fr] gap-3">
                  <div className="font-mono text-[10.5px] text-ops-faint-2">{clock(turn.at_ms)}</div>
                  <div>
                    <div className="mb-[5px] font-mono text-[10px] font-semibold">
                      <span className={turn.speaker === 'AGENT' ? 'text-accent' : 'text-ops-caller'}>
                        {turn.speaker}
                      </span>
                    </div>
                    <div className="font-sans text-[12.5px] leading-[1.6] text-ops-ink-2">{turn.text}</div>
                    {turn.llm_ms ? (
                      <div className="mt-[6px] font-mono text-[10px] text-ops-muted-3">{turn.llm_ms} ms llm</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-ops-line bg-ops-panel-4 p-[18px] xl:border-t-0 xl:border-l">
          <Eyebrow tone="ops">SESSION</Eyebrow>
          <div className="grid grid-cols-2 gap-[10px]">
            {[
              { label: 'Channel', value: call.channel },
              { label: 'Status', value: call.status },
              { label: 'Last V2V', value: call.v2v_ms ? `${call.v2v_ms} ms` : '—' },
              { label: 'Turns', value: String(turns.length) },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[8px] border border-ops-line bg-ops-panel-2 px-[11px] py-[10px]">
                <div className="font-sans text-[10.5px] text-ops-muted-2">{metric.label}</div>
                <div className="mt-[7px] font-mono text-[14px] font-semibold text-ops-ink">{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-ops-line pt-[14px] font-mono text-[10.5px] text-ops-muted-2">
            <div className="flex justify-between gap-3">
              <span>Started</span>
              <span className="text-ops-ink-3">{new Date(call.started_at).toLocaleString()}</span>
            </div>
            {call.ended_at ? (
              <div className="mt-2 flex justify-between gap-3">
                <span>Ended</span>
                <span className="text-ops-ink-3">{new Date(call.ended_at).toLocaleString()}</span>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  )
}

function clock(atMs: number): string {
  const total = Math.max(0, Math.floor(atMs / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

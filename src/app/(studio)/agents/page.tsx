import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { Button, Chip, Eyebrow, Meter } from '@/components/ui/primitives'
import { FleetOrb } from '@/components/orb/AgentOrb'
import { AGENTS, LATENCY_BUDGET_MS, STUDIO_METRICS, p95Tone } from '@/lib/data/agents'
import { TOTAL_LIVE } from '@/lib/data/callStore'

const GRID = 'grid grid-cols-[2.1fr_1.6fr_1fr_0.8fr_0.8fr_0.8fr] gap-[14px]'

export default function AgentsPage() {
  return (
    <>
      <TopBar />

      <div className="flex-1 overflow-y-auto px-[26px] pt-[26px] pb-[26px]">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-sans text-[22px] leading-[1.1] font-semibold tracking-[-0.3px] text-ink">
              Agents
            </h1>
            <p className="mt-[5px] font-sans text-[12.5px] leading-[1.4] text-muted">
              {AGENTS.length} agents · {AGENTS.filter((a) => a.status === 'live').length} live on
              PSTN via Exotel · cascaded STT→LLM→TTS unless marked
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost">Import from JSON</Button>
            <Button variant="primary">New agent</Button>
          </div>
        </div>

        {/* Fleet metrics. The last tile is the live-traffic pulse. */}
        <div className="mb-5 grid grid-cols-4 gap-3">
          <MetricTile metric={STUDIO_METRICS[0]} />

          <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
            <Eyebrow>{STUDIO_METRICS[1].label}</Eyebrow>
            <div className="mt-[9px] flex items-baseline gap-[5px]">
              <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
                {STUDIO_METRICS[1].value}
              </span>
              <span className="font-sans text-[12px] leading-none font-medium text-muted">ms</span>
            </div>
            <div className="mt-[11px]">
              <Meter
                pct={(762 / LATENCY_BUDGET_MS) * 100}
                color="var(--color-good)"
                track="#efe9e1"
                targetPct={100}
              />
            </div>
            <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
              {STUDIO_METRICS[1].note}
            </div>
          </div>

          <MetricTile metric={STUDIO_METRICS[2]} />

          <Link
            href="/calls"
            className="group rounded-[9px] border border-line bg-ink p-[14px_15px] transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,.22)]"
            data-theme="dark"
          >
            <Eyebrow tone="ops">LIVE NOW</Eyebrow>
            <div className="mt-[9px] flex items-baseline gap-2">
              <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-white">
                {TOTAL_LIVE.toLocaleString('en-US')}
              </span>
              <span className="font-sans text-[11.5px] leading-none font-medium text-faint">
                calls
              </span>
            </div>
            <div className="mt-[10px] flex items-center gap-[10px]">
              <FleetOrb size={20} concurrency={TOTAL_LIVE} />
              <span className="font-mono text-[10.5px] leading-none font-medium text-muted-2">
                4 barge-ins/min
              </span>
              <span className="ml-auto font-sans text-[11px] leading-none font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Monitor →
              </span>
            </div>
          </Link>
        </div>

        {/* Agent table. A row opens the builder. */}
        <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
          <div
            className={`${GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
          >
            <div>AGENT</div>
            <div>PIPELINE</div>
            <div>SERIES / CARRIER</div>
            <div className="text-right">P95 V2V</div>
            <div className="text-right">CALLS 7D</div>
            <div className="text-right">$/MIN</div>
          </div>

          {AGENTS.map((agent, i) => {
            const tone = p95Tone(agent.p95Ms)
            const draft = agent.status === 'draft'
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className={`${GRID} items-center px-4 py-[13px] transition-colors hover:bg-panel-2 ${
                  i < AGENTS.length - 1 ? 'border-b border-line-4' : ''
                } ${draft ? 'bg-panel-3' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-[6px] w-[6px] rounded-full ${
                        draft ? 'bg-faint-3' : 'bg-good'
                      }`}
                    />
                    <span
                      className={`font-sans text-[13px] leading-[1.2] font-semibold ${
                        draft ? 'text-ink-3' : 'text-ink'
                      }`}
                    >
                      {agent.name}
                    </span>
                    <Chip tone={agent.localeTone === 'risk' ? 'accent' : 'outline'}>
                      {agent.locale}
                    </Chip>
                  </div>
                  <div className="mt-1 font-sans text-[11.5px] leading-[1.3] text-muted-2">
                    {agent.summary}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {agent.pipeline.map((stage) => (
                    <Chip key={stage}>{stage}</Chip>
                  ))}
                </div>

                <div className="font-sans text-[11.5px] leading-[1.3] font-medium text-ink-3">
                  {agent.series}
                  <div className="mt-[3px] font-sans text-[11px] leading-none text-muted-3">
                    {agent.carrier}
                  </div>
                </div>

                <div
                  className={`text-right font-mono text-[12.5px] leading-none ${
                    tone === 'over'
                      ? 'font-semibold text-accent-deep'
                      : tone === 'muted'
                        ? 'font-medium text-muted-3'
                        : 'font-semibold text-ink'
                  }`}
                >
                  {agent.p95Ms === null ? (
                    '—'
                  ) : (
                    <>
                      {agent.p95Ms}
                      <span
                        className={`font-normal ${tone === 'over' ? 'text-[#c9a094]' : 'text-muted-3'}`}
                      >
                        ms
                      </span>
                    </>
                  )}
                </div>

                <div className="text-right font-mono text-[12.5px] leading-none font-medium text-ink-2">
                  {agent.calls7d === null ? (
                    <span className="text-muted-3">—</span>
                  ) : (
                    agent.calls7d.toLocaleString('en-IN')
                  )}
                </div>

                <div className="text-right font-mono text-[12.5px] leading-none font-medium text-ink-2">
                  {agent.costPerMin === null ? (
                    <span className="text-muted-3">—</span>
                  ) : (
                    agent.costPerMin.toFixed(2)
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

function MetricTile({
  metric,
}: {
  metric: { label: string; value: string; unit?: string; delta?: string; note?: string }
}) {
  return (
    <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
      <Eyebrow>{metric.label}</Eyebrow>
      <div className="mt-[9px] flex items-baseline gap-[7px]">
        <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
          {metric.value}
        </span>
        {metric.unit ? (
          <span className="font-sans text-[12px] leading-none font-medium text-muted">
            {metric.unit}
          </span>
        ) : null}
        {metric.delta ? (
          <span className="font-sans text-[11px] leading-none font-semibold text-good">
            {metric.delta}
          </span>
        ) : null}
      </div>
      {metric.note ? (
        <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
          {metric.note}
        </div>
      ) : null}
    </div>
  )
}

import { notFound } from 'next/navigation'
import { CrumbBar } from '@/components/shell/TopBar'
import { Button, Chip, Eyebrow } from '@/components/ui/primitives'
import { TestCallPanel } from '@/components/builder/TestCallPanel'
import { getAgent } from '@/lib/data/agents'
import {
  BUDGET,
  PIPELINE,
  SYSTEM_PROMPT_TOKENS,
  TOOLS,
  TURN_TAKING,
} from '@/lib/data/builder'

export default async function AgentBuilderPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = await params
  const agent = getAgent(agentId)
  if (!agent) notFound()

  const totalMs = PIPELINE.reduce((sum, s) => sum + s.latencyMs, 0)

  return (
    <>
      <CrumbBar
        crumbs={[{ label: 'Agents', href: '/agents' }, { label: agent.name }]}
        badge={<Chip tone="outline">v14 · draft</Chip>}
      >
        <Button variant="ghost" className="px-[12px] py-[7px] text-[11.5px]">
          Run eval suite
        </Button>
        <Button variant="ghost" className="px-[12px] py-[7px] text-[11.5px]">
          Diff vs live
        </Button>
        <Button variant="primary" className="px-[13px] py-[7px] text-[11.5px]">
          Publish
        </Button>
      </CrumbBar>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Pipeline router — the core IP, so it gets the top of the page. */}
        <section className="flex-none border-b border-line bg-panel px-6 pt-5 pb-4">
          <div className="mb-[13px] flex items-baseline justify-between">
            <div className="flex items-baseline gap-[10px]">
              <span className="font-sans text-[13.5px] leading-none font-semibold text-ink">
                Pipeline
              </span>
              <span className="font-sans text-[11.5px] leading-none text-muted-2">
                Cascaded — transcripts retained for DPDP audit. Each stage swappable per tenant.
              </span>
            </div>
            <div className="flex items-center gap-[6px] font-sans text-[11px] leading-none font-medium text-ink-3">
              <span className="font-mono text-[10px] text-muted-3">TOPOLOGY</span>
              <span className="rounded-[5px] border border-accent bg-accent-tint px-2 py-1 font-semibold text-accent-deep">
                Cascaded
              </span>
              <span className="rounded-[5px] border border-line px-2 py-1 text-muted-3">
                Native S2S
              </span>
            </div>
          </div>

          <div className="flex items-stretch">
            {PIPELINE.map((stage, i) => (
              <div key={stage.key} className="contents">
                {i > 0 ? (
                  <div className="flex w-[26px] items-center justify-center font-mono text-[13px] leading-none font-medium text-faint-2">
                    →
                  </div>
                ) : null}
                <div
                  className={`flex-1 rounded-[9px] p-3 ${
                    stage.active
                      ? 'border-[1.5px] border-accent bg-panel shadow-[0_2px_10px_rgba(228,87,46,.13)]'
                      : 'border border-line bg-panel-2'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] ${
                        stage.active ? 'text-accent-deep' : 'text-muted-4'
                      }`}
                    >
                      {stage.step}
                    </span>
                    <span
                      className={`font-mono text-[9.5px] leading-none font-medium ${
                        stage.hostingTone === 'good' ? 'text-good' : 'text-muted-3'
                      }`}
                    >
                      {stage.hosting}
                    </span>
                  </div>
                  <div className="mt-[9px] font-sans text-[13px] leading-[1.2] font-semibold text-ink">
                    {stage.model}
                  </div>
                  <div className="mt-[3px] font-sans text-[11px] leading-[1.3] text-muted-2">
                    {stage.detail}
                  </div>
                  <div
                    className={`mt-[11px] flex items-baseline justify-between border-t pt-[9px] ${
                      stage.active ? 'border-[#f3e7e1]' : 'border-line-3'
                    }`}
                  >
                    <span className="font-mono text-[12px] leading-none font-semibold text-ink">
                      {stage.latencyMs} ms
                      {stage.latencyQualifier ? (
                        <span className="font-normal text-muted-3"> {stage.latencyQualifier}</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[10.5px] leading-none text-muted-3">
                      {stage.cost}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Latency budget — the same five stages, as a share of 800 ms. */}
          <div className="mt-4 rounded-[9px] border border-line bg-panel-2 px-[14px] py-3">
            <div className="mb-[9px] flex items-baseline justify-between">
              <Eyebrow>VOICE-TO-VOICE BUDGET</Eyebrow>
              <span className="font-sans text-[11.5px] leading-none font-medium text-ink-3">
                <span className="font-mono text-[13px] font-semibold text-ink">
                  {BUDGET.p50} ms
                </span>{' '}
                measured P50 · {BUDGET.p95} ms P95 · {BUDGET.target} ms target
              </span>
            </div>

            <div className="flex h-3 overflow-hidden rounded-[3px] bg-[#efe9e1]">
              {PIPELINE.map((stage) => (
                <div
                  key={stage.key}
                  style={{
                    width: `${(stage.latencyMs / totalMs) * 100}%`,
                    background: stage.budgetColor,
                  }}
                  title={`${stage.model} — ${stage.latencyMs} ms`}
                />
              ))}
            </div>

            <div className="mt-[9px] flex gap-[18px] font-mono text-[10.5px] leading-none font-medium text-muted">
              {PIPELINE.map((stage) => (
                <span key={stage.key}>
                  <span
                    className="mr-[5px] inline-block h-[7px] w-[7px] rounded-[2px] align-middle"
                    style={{ background: stage.budgetColor }}
                  />
                  {stage.budgetLabel}
                </span>
              ))}
              <span className="ml-auto text-accent-deep">{BUDGET.hint}</span>
            </div>
          </div>
        </section>

        {/* Prompt + behaviour, with the test rail pinned right. */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_344px]">
          <div className="flex flex-col gap-[14px] overflow-y-auto px-6 py-5">
            <div className="overflow-hidden rounded-[9px] border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line-3 px-[14px] py-[11px]">
                <span className="font-sans text-[12px] leading-none font-semibold text-ink">
                  System prompt
                </span>
                <span className="font-mono text-[10px] leading-none font-medium text-muted-3">
                  {SYSTEM_PROMPT_TOKENS}
                </span>
              </div>
              <div className="px-[14px] py-[13px] font-mono text-[12px] leading-[1.65] text-ink-2">
                You are Meera, a collections assistant for Acme Finance NBFC.
                <br />
                <span className="text-muted-3">
                  {'// Open every call with the AI + recording disclosure in the customer’s language.'}
                </span>
                <br />
                Speak Hinglish naturally. Never threaten. If the customer disputes the amount, hand
                off to a human via <span className="text-accent-deep">transfer_to_agent</span>.
                <br />
                Confirm any promise-to-pay date by repeating it back, then call{' '}
                <span className="text-accent-deep">log_ptp(date, amount)</span>.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[14px]">
              <div className="rounded-[9px] border border-line bg-panel px-[14px] py-[13px]">
                <div className="mb-[11px] font-sans text-[12px] leading-none font-semibold text-ink">
                  Turn taking
                </div>
                {TURN_TAKING.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between py-[6px] ${
                      i < TURN_TAKING.length - 1 ? 'border-b border-line-5' : ''
                    }`}
                  >
                    <span className="font-sans text-[11.5px] leading-none text-ink-3">
                      {row.label}
                    </span>
                    <span
                      className={`font-mono text-[11px] leading-none font-medium ${
                        row.tone === 'good' ? 'text-good' : 'text-ink'
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-[9px] border border-line bg-panel px-[14px] py-[13px]">
                <div className="mb-[11px] flex items-center justify-between">
                  <span className="font-sans text-[12px] leading-none font-semibold text-ink">
                    Tools
                  </span>
                  <span className="font-mono text-[10px] leading-none font-medium text-accent-deep">
                    + add
                  </span>
                </div>
                <div className="flex flex-col gap-[6px]">
                  {TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex justify-between rounded-[6px] border border-line-3 px-[9px] py-[7px]"
                    >
                      <span className="font-mono text-[11px] leading-none font-medium text-ink-2">
                        {tool.name}
                      </span>
                      <span className="font-mono text-[10px] leading-none text-muted-3">
                        {tool.note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-[14px] overflow-y-auto border-l border-line bg-panel p-5">
            <TestCallPanel />
          </aside>
        </div>
      </div>
    </>
  )
}

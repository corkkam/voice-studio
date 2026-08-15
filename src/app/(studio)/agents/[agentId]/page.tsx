import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { CrumbBar } from '@/components/shell/TopBar'
import { Chip, Eyebrow } from '@/components/ui/primitives'
import { TestCallPanel } from '@/components/builder/TestCallPanel'
import { ConnectPanel } from '@/components/builder/ConnectPanel'
import { PublishButton, SavePromptForm } from '@/components/builder/AgentEditor'
import { requireAuth } from '@/lib/auth/session'
import { getAgentRow } from '@/lib/store/agents'
import { parsePipeline } from '@/lib/store/types'
import { TURN_TAKING } from '@/lib/data/defaults'
import { BUDGET, TOOLS } from '@/lib/data/builder'

export default async function AgentBuilderPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const auth = await requireAuth()
  const { agentId } = await params
  const agent = getAgentRow(auth.tenant.id, agentId)
  if (!agent) notFound()

  const pipeline = parsePipeline(agent.pipeline_json)
  const totalMs = pipeline.reduce((sum, s) => sum + s.latencyMs, 0) || 1
  const host = await requestBase()

  return (
    <>
      <CrumbBar
        crumbs={[{ label: 'Agents', href: '/agents' }, { label: agent.name }]}
        badge={
          <Chip tone="outline">
            v{agent.version} · {agent.status}
          </Chip>
        }
      >
        <PublishButton agentId={agent.id} live={agent.status === 'live'} />
      </CrumbBar>

      <div className="flex min-h-0 flex-1 flex-col">
        <section className="flex-none border-b border-line bg-panel px-6 pt-5 pb-4">
          <div className="mb-[13px] flex items-baseline justify-between">
            <div className="flex items-baseline gap-[10px]">
              <span className="font-sans text-[13.5px] leading-none font-semibold text-ink">Pipeline</span>
              <span className="font-sans text-[11.5px] leading-none text-muted-2">
                Cascaded — client STT/TTS, turn complete on the media route. Numbers are budgets.
              </span>
            </div>
            <div className="flex items-center gap-[6px] font-sans text-[11px] leading-none font-medium text-ink-3">
              <span className="font-mono text-[10px] text-muted-3">TOPOLOGY</span>
              <span className="rounded-[5px] border border-accent bg-accent-tint px-2 py-1 font-semibold text-accent-deep">
                Cascaded
              </span>
            </div>
          </div>

          <div className="flex items-stretch">
            {pipeline.map((stage, i) => (
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
                  <div className="mt-[3px] font-sans text-[11px] leading-[1.3] text-muted-2">{stage.detail}</div>
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
                    <span className="font-mono text-[10.5px] leading-none text-muted-3">{stage.cost}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[9px] border border-line bg-panel-2 px-[14px] py-3">
            <div className="mb-[9px] flex items-baseline justify-between">
              <Eyebrow>VOICE-TO-VOICE BUDGET</Eyebrow>
              <span className="font-sans text-[11.5px] leading-none font-medium text-ink-3">
                {BUDGET.target} ms target · measured P50/P95 appear after live turns
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-[3px] bg-[#efe9e1]">
              {pipeline.map((stage) => (
                <div
                  key={stage.key}
                  style={{ width: `${(stage.latencyMs / totalMs) * 100}%`, background: stage.budgetColor }}
                  title={`${stage.model} — ${stage.latencyMs} ms budget`}
                />
              ))}
            </div>
            <div className="mt-[9px] flex gap-[18px] font-mono text-[10.5px] leading-none font-medium text-muted">
              {pipeline.map((stage) => (
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

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_344px]">
          <div className="flex flex-col gap-[14px] overflow-y-auto px-6 py-5">
            <SavePromptForm
              agentId={agent.id}
              name={agent.name}
              locale={agent.locale}
              summary={agent.summary}
              prompt={agent.system_prompt}
            />

            <ConnectPanel
              agentId={agent.id}
              agentName={agent.name}
              baseUrl={host}
              published={agent.status === 'live'}
            />

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
                    <span className="font-sans text-[11.5px] leading-none text-ink-3">{row.label}</span>
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
                <div className="mb-[11px] font-sans text-[12px] leading-none font-semibold text-ink">Tools</div>
                <div className="flex flex-col gap-[6px]">
                  {TOOLS.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex justify-between rounded-[6px] border border-line-3 px-[9px] py-[7px]"
                    >
                      <span className="font-mono text-[11px] leading-none font-medium text-ink-2">
                        {tool.name}
                      </span>
                      <span className="font-mono text-[10px] leading-none text-muted-3">{tool.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-[14px] overflow-y-auto border-l border-line bg-panel p-5">
            <TestCallPanel agentId={agent.id} />
          </aside>
        </div>
      </div>
    </>
  )
}

async function requestBase(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

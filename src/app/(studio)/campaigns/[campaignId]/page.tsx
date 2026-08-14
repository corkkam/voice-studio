import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CrumbBar } from '@/components/shell/TopBar'
import { Button, Eyebrow, Meter } from '@/components/ui/primitives'
import { CampaignRows } from '@/components/campaign/CampaignRows'
import { EMPTY_GATE, type GateCheck } from '@/lib/data/campaign'
import { requireAuth } from '@/lib/auth/session'
import { getCampaign } from '@/lib/store/campaigns'
import { getAgentRow } from '@/lib/store/agents'
import { countLive } from '@/lib/store/calls'

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  const auth = await requireAuth()
  const { campaignId } = await params
  const campaign = getCampaign(auth.tenant.id, campaignId)
  if (!campaign) notFound()
  const agent = campaign.agent_id ? getAgentRow(auth.tenant.id, campaign.agent_id) : undefined
  const live = countLive(auth.tenant.id)

  return (
    <>
      <CrumbBar
        crumbs={[{ label: 'Campaigns', href: '/campaigns' }, { label: campaign.name }]}
        badge={
          <span className="rounded-[4px] border border-line px-[6px] py-[3px] font-mono text-[10px] font-medium text-muted">
            {campaign.status}
          </span>
        }
      >
        <Link
          href="/calls"
          className="flex items-center gap-[6px] font-sans text-[11.5px] font-semibold text-accent-deep hover:text-accent"
        >
          <span className="h-[6px] w-[6px] rounded-full bg-accent" />
          {live} live now →
        </Link>
        <Button variant="dark" className="px-[13px] py-[7px] text-[11.5px]" disabled>
          Start dialer
        </Button>
      </CrumbBar>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_380px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden p-6">
          <div>
            <h1 className="font-sans text-[21px] font-semibold tracking-[-0.3px] text-ink">
              {campaign.name}
            </h1>
            <p className="mt-[5px] font-sans text-[12.5px] text-muted">
              Agent: {agent?.name ?? 'unassigned'} · no numbers dialed
            </p>
          </div>

          <div className="flex-none rounded-[10px] border border-line bg-panel px-5 py-[18px]">
            <div className="mb-[14px] font-sans text-[12px] font-semibold text-ink">Funnel · 0 dialed</div>
            {[
              { label: 'Connected', value: '0', pct: 0 },
              { label: 'Reached intent', value: '0', pct: 0 },
              { label: 'Promise to pay logged', value: '0', pct: 0 },
              { label: 'Transferred to human', value: '0', pct: 0 },
            ].map((step) => (
              <div key={step.label} className="mb-[11px]">
                <div className="mb-[5px] flex justify-between font-sans text-[11.5px] text-ink-2">
                  <span>{step.label}</span>
                  <span className="font-mono font-semibold">{step.value}</span>
                </div>
                <Meter pct={step.pct} color="#1c1917" track="#f1ece5" height={10} />
              </div>
            ))}
          </div>

          <CampaignRows rows={[]} />
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-line bg-panel px-5 py-[22px] xl:border-t-0 xl:border-l">
          <div>
            <div className="font-sans text-[13px] font-semibold text-ink">Compliance gate</div>
            <p className="mt-[5px] font-sans text-[11.5px] leading-[1.45] text-muted">
              The dialer stays locked until every check is real. Nothing here is pre-ticked.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {EMPTY_GATE.map((check) => (
              <GateRow key={check.title} check={check} />
            ))}
          </div>
        </aside>
      </div>
    </>
  )
}

function GateRow({ check }: { check: GateCheck }) {
  const styles = {
    pass: { box: 'border-good-line bg-good-tint', dot: 'bg-good' },
    warn: { box: 'border-accent-line bg-accent-tint-2', dot: 'bg-accent' },
    off: { box: 'border-line-3 bg-panel', dot: 'bg-faint-3' },
  }[check.state]

  return (
    <div className={`flex items-start gap-[10px] rounded-[8px] border px-[11px] py-[10px] ${styles.box}`}>
      <div className={`mt-px h-[14px] w-[14px] flex-none rounded-[4px] ${styles.dot}`} />
      <div>
        <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">{check.title}</div>
        <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">{check.detail}</div>
        {check.action ? (
          <div className="mt-[6px] font-sans text-[10.5px] font-semibold text-accent-deep">{check.action}</div>
        ) : null}
      </div>
    </div>
  )
}

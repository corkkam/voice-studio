import Link from 'next/link'
import { CrumbBar } from '@/components/shell/TopBar'
import { Button, Eyebrow, Meter } from '@/components/ui/primitives'
import { CampaignRows } from '@/components/campaign/CampaignRows'
import {
  CAMPAIGN,
  DISCLOSURE_CLIP,
  FUNNEL,
  FUNNEL_STATS,
  GATE_CHECKS,
  GATE_TRAILING,
  SPAM_RISK,
  type GateCheck,
} from '@/lib/data/campaign'

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>
}) {
  await params

  return (
    <>
      <CrumbBar
        crumbs={[{ label: 'Campaigns' }, { label: CAMPAIGN.name }]}
        badge={
          <span className="rounded-[4px] border border-[#d5e5de] bg-[#eef4f1] px-[6px] py-[3px] font-mono text-[10px] leading-none font-medium text-good-deep">
            {CAMPAIGN.status}
          </span>
        }
      >
        <Link
          href="/calls"
          className="flex items-center gap-[6px] font-sans text-[11.5px] leading-none font-semibold text-accent-deep hover:text-accent"
        >
          <span className="h-[6px] w-[6px] rounded-full bg-accent" />
          {CAMPAIGN.liveNow} live now →
        </Link>
        <Button variant="ghost" className="px-[12px] py-[7px] text-[11.5px]">
          Pause
        </Button>
        <Button variant="dark" className="px-[13px] py-[7px] text-[11.5px]">
          Export report
        </Button>
      </CrumbBar>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_380px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-sans text-[21px] leading-[1.1] font-semibold tracking-[-0.3px] text-ink">
                {CAMPAIGN.name}
              </h1>
              <p className="mt-[5px] font-sans text-[12.5px] leading-[1.4] text-muted">
                {CAMPAIGN.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CAMPAIGN.knobs.map((knob) => (
                <span
                  key={knob}
                  className="rounded-[5px] border border-line-2 bg-panel px-[9px] py-[7px] font-mono text-[10.5px] leading-none font-medium text-ink-3"
                >
                  {knob}
                </span>
              ))}
            </div>
          </div>

          {/* Funnel */}
          <div className="flex-none rounded-[10px] border border-line bg-panel px-5 py-[18px]">
            <div className="mb-[14px] flex items-baseline justify-between gap-3">
              <span className="font-sans text-[12px] leading-none font-semibold text-ink">
                Funnel · {CAMPAIGN.dialed} dialed of {CAMPAIGN.total}
              </span>
              <span className="font-mono text-[11px] leading-none font-medium text-muted-2">
                {CAMPAIGN.updated}
              </span>
            </div>

            <div className="flex flex-col gap-[11px]">
              {FUNNEL.map((step) => (
                <div key={step.label}>
                  <div className="mb-[5px] flex justify-between gap-3 font-sans text-[11.5px] leading-none font-medium text-ink-2">
                    <span>{step.label}</span>
                    <span className="flex-none font-mono text-[11.5px] font-semibold">
                      {step.value}
                    </span>
                  </div>
                  <Meter pct={step.pct} color={step.color} track="#f1ece5" height={10} />
                </div>
              ))}
            </div>

            <div className="mt-[18px] grid grid-cols-2 gap-[14px] border-t border-[#f1ece5] pt-4 sm:grid-cols-4">
              {FUNNEL_STATS.map((stat) => (
                <div key={stat.label}>
                  <Eyebrow>{stat.label}</Eyebrow>
                  <div className="mt-[7px] font-mono text-[17px] leading-none font-semibold text-ink">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CampaignRows />
        </div>

        {/* Compliance gate — checks live where the decision is made. */}
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-line bg-panel px-5 py-[22px] xl:border-t-0 xl:border-l">
          <div>
            <div className="font-sans text-[13px] leading-none font-semibold text-ink">
              Compliance gate
            </div>
            <p className="mt-[5px] font-sans text-[11.5px] leading-[1.45] text-muted">
              All checks must pass before the dialer can start. Re-validated every 30 min.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {GATE_CHECKS.map((check) => (
              <GateRow key={check.title} check={check} />
            ))}

            <div className="rounded-[8px] border border-line-3 p-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
                  {DISCLOSURE_CLIP.title}
                </span>
                <span className="flex-none font-mono text-[10px] leading-none font-medium text-accent-deep">
                  {DISCLOSURE_CLIP.action}
                </span>
              </div>
              <div className="mt-[9px] flex h-[22px] items-center gap-px">
                {DISCLOSURE_CLIP.bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      height: `${h}%`,
                      background: i < DISCLOSURE_CLIP.played ? '#e4572e' : '#e8e2da',
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 font-mono text-[10.5px] leading-[1.4] text-muted-2">
                {DISCLOSURE_CLIP.quote}
              </p>
            </div>

            <GateRow check={GATE_TRAILING} />
          </div>

          <div className="border-t border-line-3 pt-[14px]">
            <Eyebrow className="mb-[9px]">SPAM-RISK SIGNAL</Eyebrow>
            <div className="mb-[6px] flex justify-between gap-3 font-sans text-[11px] leading-none font-medium text-ink-3">
              <span>{SPAM_RISK.label}</span>
              <span className="flex-none font-mono text-[11px] font-semibold text-ink">
                {SPAM_RISK.value}
              </span>
            </div>
            <Meter
              pct={SPAM_RISK.pct}
              color="var(--color-good)"
              track="#f1ece5"
              height={6}
              targetPct={SPAM_RISK.thresholdPct}
              targetColor="var(--color-accent-deep)"
            />
            <p className="mt-[7px] font-mono text-[10.5px] leading-[1.4] text-muted-2">
              {SPAM_RISK.note}
            </p>
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
        <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
          {check.title}
        </div>
        <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">
          {check.detail}
        </div>
        {check.action ? (
          <div className="mt-[6px] font-sans text-[10.5px] leading-none font-semibold text-accent-deep">
            {check.action}
          </div>
        ) : null}
      </div>
    </div>
  )
}

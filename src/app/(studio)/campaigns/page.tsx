import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { Button } from '@/components/ui/primitives'
import { requireAuth } from '@/lib/auth/session'
import { listCampaigns } from '@/lib/store/campaigns'
import { listAgents } from '@/lib/store/agents'
import { NewCampaignForm } from '@/components/campaign/NewCampaignForm'

export default async function CampaignsPage() {
  const auth = await requireAuth()
  const campaigns = listCampaigns(auth.tenant.id)
  const agents = listAgents(auth.tenant.id)

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">Campaigns</h1>
            <p className="mt-[6px] font-sans text-[13px] text-muted">
              Outbound dialing is still gated. Campaigns exist so compliance has a place to sit.
            </p>
          </div>
        </div>

        <NewCampaignForm agents={agents.map((a) => ({ id: a.id, name: a.name }))} />

        <div className="mt-6 overflow-hidden rounded-[10px] border border-line bg-panel">
          {campaigns.length === 0 ? (
            <div className="px-4 py-16 text-center font-sans text-[13px] text-muted">
              No campaigns. Create a draft — the dialer will not start until the compliance gate
              passes.
            </div>
          ) : (
            campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="flex items-center justify-between border-b border-line-4 px-4 py-3 last:border-b-0 hover:bg-panel-2"
              >
                <div>
                  <div className="font-sans text-[13px] font-semibold text-ink">{campaign.name}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">{campaign.status}</div>
                </div>
                <Button variant="ghost" className="pointer-events-none">
                  Open
                </Button>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}

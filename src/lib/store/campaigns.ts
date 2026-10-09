import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { CampaignRow } from '@/lib/store/types'

export function listCampaigns(tenantId: string): Promise<CampaignRow[]> {
  return all<CampaignRow>('SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC', [
    tenantId,
  ])
}

export function getCampaign(
  tenantId: string,
  campaignId: string,
): Promise<CampaignRow | undefined> {
  return one<CampaignRow>('SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?', [
    campaignId,
    tenantId,
  ])
}

export async function createCampaign(
  tenantId: string,
  input: { name: string; agentId?: string },
): Promise<CampaignRow> {
  const created = now()
  const row: CampaignRow = {
    id: id('cmp'),
    tenant_id: tenantId,
    agent_id: input.agentId || null,
    name: input.name.trim(),
    status: 'DRAFT',
    created_at: created,
  }
  await run(
    `INSERT INTO campaigns (id, tenant_id, agent_id, name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.tenant_id, row.agent_id, row.name, row.status, row.created_at],
  )
  return row
}

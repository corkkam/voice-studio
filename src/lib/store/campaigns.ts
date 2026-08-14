import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { CampaignRow } from '@/lib/store/types'

export function listCampaigns(tenantId: string): CampaignRow[] {
  return rows<CampaignRow>(
    getDb().prepare('SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId),
  )
}

export function getCampaign(tenantId: string, campaignId: string): CampaignRow | undefined {
  return row<CampaignRow>(
    getDb().prepare('SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?').get(campaignId, tenantId),
  )
}

export function createCampaign(
  tenantId: string,
  input: { name: string; agentId?: string },
): CampaignRow {
  const created = now()
  const row: CampaignRow = {
    id: id('cmp'),
    tenant_id: tenantId,
    agent_id: input.agentId || null,
    name: input.name.trim(),
    status: 'DRAFT',
    created_at: created,
  }
  getDb()
    .prepare(
      `INSERT INTO campaigns (id, tenant_id, agent_id, name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.tenant_id, row.agent_id, row.name, row.status, row.created_at)
  return row
}

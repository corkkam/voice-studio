import 'server-only'

import { getDb, now, rows } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { NumberIntentKind, NumberIntentRow } from '@/lib/store/types'

/*
 * There is no carrier, no PSTN number and no media plane in this product. These
 * rows are provisioning intent and nothing else: a record of the numbers and
 * trunks a workspace means to buy, and which agent should answer each. Nothing
 * here is reachable from the telephone network, and no code path dials.
 */
const KINDS: NumberIntentKind[] = ['did_inbound', 'sip_outbound', 'sip_inbound']

export const KIND_LABELS: Record<NumberIntentKind, string> = {
  did_inbound: 'DID inbound',
  sip_outbound: 'SIP outbound',
  sip_inbound: 'SIP inbound',
}

export function listNumberIntents(tenantId: string): NumberIntentRow[] {
  return rows<NumberIntentRow>(
    getDb()
      .prepare('SELECT * FROM number_intents WHERE tenant_id = ? ORDER BY created_at ASC')
      .all(tenantId),
  )
}

export function createNumberIntent(
  tenantId: string,
  input: { name: string; note?: string; kind?: string; agentId?: string; region?: string },
): NumberIntentRow {
  const kind = KINDS.includes(input.kind as NumberIntentKind)
    ? (input.kind as NumberIntentKind)
    : 'did_inbound'
  const agentId = input.agentId?.trim() || null
  const owned =
    agentId &&
    getDb().prepare('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?').get(agentId, tenantId)

  const intent: NumberIntentRow = {
    id: id('num'),
    tenant_id: tenantId,
    name: input.name.trim(),
    note: (input.note || '').trim(),
    kind,
    agent_id: owned ? agentId : null,
    region: (input.region || 'IN-SOUTH').trim(),
    created_at: now(),
  }
  getDb()
    .prepare(
      `INSERT INTO number_intents (id, tenant_id, name, note, kind, agent_id, region, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      intent.id,
      intent.tenant_id,
      intent.name,
      intent.note,
      intent.kind,
      intent.agent_id,
      intent.region,
      intent.created_at,
    )
  return intent
}

export function deleteNumberIntent(tenantId: string, intentId: string): void {
  getDb()
    .prepare('DELETE FROM number_intents WHERE id = ? AND tenant_id = ?')
    .run(intentId, tenantId)
}

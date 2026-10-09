import 'server-only'

import { all, now, one, run } from '@/lib/db'
import type { AgentPolicyRow } from '@/lib/store/types'

export const DEFAULT_RETENTION_DAYS = 30

/*
 * Policy rows are the source of truth the campaign gate reads. Two of the three
 * controls here are recorded intent, not enforcement: the disclosure line is
 * returned to the client and the client must play it, and the retention window
 * is a number with no job behind it. /compliance says so on the screen, and
 * nothing in this file should imply otherwise.
 */
export function listPolicies(tenantId: string): Promise<AgentPolicyRow[]> {
  return all<AgentPolicyRow>('SELECT * FROM agent_policies WHERE tenant_id = ?', [tenantId])
}

export function getPolicy(tenantId: string, agentId: string): Promise<AgentPolicyRow | undefined> {
  return one<AgentPolicyRow>('SELECT * FROM agent_policies WHERE agent_id = ? AND tenant_id = ?', [
    agentId,
    tenantId,
  ])
}

/** A missing row reads as an unset policy rather than as a compliant one. */
export async function policyOrEmpty(tenantId: string, agentId: string): Promise<AgentPolicyRow> {
  return (
    (await getPolicy(tenantId, agentId)) ?? {
      agent_id: agentId,
      tenant_id: tenantId,
      disclosure: '',
      retention_days: DEFAULT_RETENTION_DAYS,
      redact_pii: 0,
      updated_at: 0,
    }
  )
}

export async function savePolicy(
  tenantId: string,
  agentId: string,
  input: { disclosure?: string; retentionDays?: number; redactPii?: boolean },
): Promise<void> {
  const owned = await one('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?', [agentId, tenantId])
  if (!owned) return
  const existing = await policyOrEmpty(tenantId, agentId)
  const days = Number(input.retentionDays ?? existing.retention_days)
  await run(
    `INSERT INTO agent_policies (agent_id, tenant_id, disclosure, retention_days, redact_pii, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       disclosure = excluded.disclosure,
       retention_days = excluded.retention_days,
       redact_pii = excluded.redact_pii,
       updated_at = excluded.updated_at`,
    [
      agentId,
      tenantId,
      (input.disclosure ?? existing.disclosure).trim(),
      Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.round(days))) : DEFAULT_RETENTION_DAYS,
      input.redactPii === undefined ? existing.redact_pii : input.redactPii ? 1 : 0,
      now(),
    ],
  )
}

export interface RetentionState {
  held: number
  expired: number
}

/*
 * The retention window in milliseconds. The cast is load-bearing: retention_days
 * is an int4 and 30 * 86400000 overflows int4, which Postgres raises rather than
 * wraps. The `?::bigint` on the clock is the same story, since a parameter with
 * no context arrives untyped.
 */
const EXPIRED_WHERE = `c.tenant_id = ?
   AND c.status = 'ended'
   AND c.ended_at IS NOT NULL
   AND c.ended_at < ?::bigint - (COALESCE(p.retention_days, ?)::bigint * 86400000)`

/*
 * Counted per agent because the window is per agent. An agent with no policy row
 * is counted against DEFAULT_RETENTION_DAYS, so a workspace that has never
 * visited /compliance still gets a truthful number instead of zero.
 */
export async function retentionState(tenantId: string): Promise<RetentionState> {
  const [held, expired] = await Promise.all([
    one<{ n: number }>('SELECT COUNT(*) AS n FROM calls WHERE tenant_id = ?', [tenantId]),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM calls c
       LEFT JOIN agent_policies p ON p.agent_id = c.agent_id
       WHERE ${EXPIRED_WHERE}`,
      [tenantId, now(), DEFAULT_RETENTION_DAYS],
    ),
  ])
  return { held: Number(held?.n) || 0, expired: Number(expired?.n) || 0 }
}

/** Deletes the calls past their window. Turns go with them by cascade. */
export async function purgeExpiredCalls(tenantId: string): Promise<number> {
  const before = (await retentionState(tenantId)).expired
  await run(
    `DELETE FROM calls WHERE id IN (
       SELECT c.id FROM calls c
       LEFT JOIN agent_policies p ON p.agent_id = c.agent_id
       WHERE ${EXPIRED_WHERE}
     )`,
    [tenantId, now(), DEFAULT_RETENTION_DAYS],
  )
  return before
}

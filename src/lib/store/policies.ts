import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import type { AgentPolicyRow } from '@/lib/store/types'

export const DEFAULT_RETENTION_DAYS = 30

/*
 * Policy rows are the source of truth the campaign gate reads. Two of the three
 * controls here are recorded intent, not enforcement: the disclosure line is
 * returned to the client and the client must play it, and the retention window
 * is a number with no job behind it. /compliance says so on the screen, and
 * nothing in this file should imply otherwise.
 */
export function listPolicies(tenantId: string): AgentPolicyRow[] {
  return rows<AgentPolicyRow>(
    getDb().prepare('SELECT * FROM agent_policies WHERE tenant_id = ?').all(tenantId),
  )
}

export function getPolicy(tenantId: string, agentId: string): AgentPolicyRow | undefined {
  return row<AgentPolicyRow>(
    getDb()
      .prepare('SELECT * FROM agent_policies WHERE agent_id = ? AND tenant_id = ?')
      .get(agentId, tenantId),
  )
}

/** A missing row reads as an unset policy rather than as a compliant one. */
export function policyOrEmpty(tenantId: string, agentId: string): AgentPolicyRow {
  return (
    getPolicy(tenantId, agentId) ?? {
      agent_id: agentId,
      tenant_id: tenantId,
      disclosure: '',
      retention_days: DEFAULT_RETENTION_DAYS,
      redact_pii: 0,
      updated_at: 0,
    }
  )
}

export function savePolicy(
  tenantId: string,
  agentId: string,
  input: { disclosure?: string; retentionDays?: number; redactPii?: boolean },
): void {
  const db = getDb()
  const owned = db
    .prepare('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?')
    .get(agentId, tenantId)
  if (!owned) return
  const existing = policyOrEmpty(tenantId, agentId)
  const days = Number(input.retentionDays ?? existing.retention_days)
  db.prepare(
    `INSERT INTO agent_policies (agent_id, tenant_id, disclosure, retention_days, redact_pii, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       disclosure = excluded.disclosure,
       retention_days = excluded.retention_days,
       redact_pii = excluded.redact_pii,
       updated_at = excluded.updated_at`,
  ).run(
    agentId,
    tenantId,
    (input.disclosure ?? existing.disclosure).trim(),
    Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.round(days))) : DEFAULT_RETENTION_DAYS,
    input.redactPii === undefined ? existing.redact_pii : input.redactPii ? 1 : 0,
    now(),
  )
}

export interface RetentionState {
  held: number
  expired: number
}

/*
 * Counted per agent because the window is per agent. An agent with no policy row
 * is counted against DEFAULT_RETENTION_DAYS, so a workspace that has never
 * visited /compliance still gets a truthful number instead of zero.
 */
export function retentionState(tenantId: string): RetentionState {
  const db = getDb()
  const held = db
    .prepare('SELECT COUNT(*) AS n FROM calls WHERE tenant_id = ?')
    .get(tenantId) as { n: number }
  const expired = db
    .prepare(
      `SELECT COUNT(*) AS n FROM calls c
       LEFT JOIN agent_policies p ON p.agent_id = c.agent_id
       WHERE c.tenant_id = ?
         AND c.status = 'ended'
         AND c.ended_at IS NOT NULL
         AND c.ended_at < ? - (COALESCE(p.retention_days, ?) * 86400000)`,
    )
    .get(tenantId, now(), DEFAULT_RETENTION_DAYS) as { n: number }
  return { held: Number(held.n) || 0, expired: Number(expired.n) || 0 }
}

/** Deletes the calls past their window. Turns go with them by cascade. */
export function purgeExpiredCalls(tenantId: string): number {
  const db = getDb()
  const before = retentionState(tenantId).expired
  db.prepare(
    `DELETE FROM calls WHERE id IN (
       SELECT c.id FROM calls c
       LEFT JOIN agent_policies p ON p.agent_id = c.agent_id
       WHERE c.tenant_id = ?
         AND c.status = 'ended'
         AND c.ended_at IS NOT NULL
         AND c.ended_at < ? - (COALESCE(p.retention_days, ?) * 86400000)
     )`,
  ).run(tenantId, now(), DEFAULT_RETENTION_DAYS)
  return before
}

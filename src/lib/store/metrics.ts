import 'server-only'

import { getDb, now } from '@/lib/db'
import type { StudioMetric } from '@/lib/data/agents'
import { countLive } from '@/lib/store/calls'

export function studioMetrics(tenantId: string): StudioMetric[] {
  const db = getDb()
  const start = startOfMonth()
  const minutesRow = db
    .prepare(
      `SELECT COALESCE(SUM(
         CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at
              ELSE ? - started_at END
       ), 0) AS ms
       FROM calls WHERE tenant_id = ? AND started_at >= ?`,
    )
    .get(now(), tenantId, start) as { ms: number }
  const minutes = Math.round(Number(minutesRow.ms) / 60000)

  const samples = db
    .prepare(
      `SELECT t.v2v_ms AS v2v FROM call_turns t
       JOIN calls c ON c.id = t.call_id
       WHERE c.tenant_id = ? AND t.v2v_ms IS NOT NULL
       ORDER BY t.v2v_ms`,
    )
    .all(tenantId) as { v2v: number }[]
  const p95 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))].v2v : null

  return [
    {
      label: 'VOICE MINUTES · MTD',
      value: minutes.toLocaleString('en-US'),
      note: minutes === 0 ? 'No billed minutes yet' : 'From ended and in-flight sessions',
    },
    {
      label: 'VOICE-TO-VOICE P95',
      value: p95 === null ? '—' : String(p95),
      unit: p95 === null ? undefined : 'ms',
      note: p95 === null ? 'Measured after the first real turns' : 'budget 800 ms',
    },
    {
      label: 'BLENDED COST',
      value: '—',
      note: 'Metering lands with keys & billing',
    },
  ]
}

/** Lifetime call count per agent, for the compliance table. */
export function countCallsByAgent(tenantId: string): Record<string, number> {
  const found = getDb()
    .prepare('SELECT agent_id, COUNT(*) AS n FROM calls WHERE tenant_id = ? GROUP BY agent_id')
    .all(tenantId) as { agent_id: string; n: number }[]
  return Object.fromEntries(found.map((item) => [item.agent_id, Number(item.n) || 0]))
}

export function mediaPlane(tenantId: string) {
  const live = countLive(tenantId)
  return {
    region: 'Client SDK plane',
    health: 'healthy' as const,
    gpuUtil: 0,
    sessions: live,
    capacity: 0,
  }
}

function startOfMonth(): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

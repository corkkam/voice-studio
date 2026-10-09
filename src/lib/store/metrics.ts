import 'server-only'

import { all, now, one } from '@/lib/db'
import type { StudioMetric } from '@/lib/data/agents'
import { countLive } from '@/lib/store/calls'

export async function studioMetrics(tenantId: string): Promise<StudioMetric[]> {
  const start = startOfMonth()
  // SUM over BIGINT returns numeric, which arrives as a string, so the total is
  // cast back to an integer millisecond count in SQL rather than in JS.
  const minutesRow = await one<{ ms: number }>(
    `SELECT COALESCE(SUM(
       CASE WHEN ended_at IS NOT NULL THEN ended_at - started_at
            ELSE ?::bigint - started_at END
     ), 0)::bigint AS ms
     FROM calls WHERE tenant_id = ? AND started_at >= ?`,
    [now(), tenantId, start],
  )
  const minutes = Math.round(Number(minutesRow?.ms ?? 0) / 60000)

  const samples = await all<{ v2v: number }>(
    `SELECT t.v2v_ms AS v2v FROM call_turns t
     JOIN calls c ON c.id = t.call_id
     WHERE c.tenant_id = ? AND t.v2v_ms IS NOT NULL
     ORDER BY t.v2v_ms`,
    [tenantId],
  )
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
export async function countCallsByAgent(tenantId: string): Promise<Record<string, number>> {
  const found = await all<{ agent_id: string; n: number }>(
    'SELECT agent_id, COUNT(*) AS n FROM calls WHERE tenant_id = ? GROUP BY agent_id',
    [tenantId],
  )
  return Object.fromEntries(found.map((item) => [item.agent_id, Number(item.n) || 0]))
}

export async function mediaPlane(tenantId: string) {
  const live = await countLive(tenantId)
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

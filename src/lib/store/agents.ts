import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id, slugify } from '@/lib/db/ids'
import { DEFAULT_PIPELINE, DEFAULT_PROMPT } from '@/lib/data/defaults'
import type { Agent } from '@/lib/data/agents'
import type { AgentRow, AgentStatus } from '@/lib/store/types'
import { parsePipeline } from '@/lib/store/types'

export function listAgents(tenantId: string): Agent[] {
  return rows<AgentRow>(
    getDb().prepare('SELECT * FROM agents WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId),
  ).map(toAgent)
}

export function getAgentRow(tenantId: string, agentId: string): AgentRow | undefined {
  return row<AgentRow>(
    getDb().prepare('SELECT * FROM agents WHERE id = ? AND tenant_id = ?').get(agentId, tenantId),
  )
}

export function getAgentById(agentId: string): AgentRow | undefined {
  return row<AgentRow>(getDb().prepare('SELECT * FROM agents WHERE id = ?').get(agentId))
}

export function createAgent(
  tenantId: string,
  input: { name: string; locale?: string; summary?: string; prompt?: string },
): AgentRow {
  const db = getDb()
  const created = now()
  const base = slugify(input.name, 'agent')
  let slug = base
  let n = 1
  while (db.prepare('SELECT 1 FROM agents WHERE tenant_id = ? AND slug = ?').get(tenantId, slug)) {
    slug = `${base}-${++n}`
  }
  const row: AgentRow = {
    id: id('agt'),
    tenant_id: tenantId,
    name: input.name.trim(),
    slug,
    locale: (input.locale || 'en').trim(),
    locale_tone: 'neutral',
    summary: (input.summary || 'Voice agent · web and macOS').trim(),
    status: 'draft',
    pipeline_json: JSON.stringify(DEFAULT_PIPELINE),
    series: 'Web / SDK',
    carrier: 'Web + macOS',
    system_prompt: (input.prompt || DEFAULT_PROMPT).trim(),
    topology: 'cascaded',
    version: 1,
    created_at: created,
    updated_at: created,
    published_at: null,
  }
  db.prepare(
    `INSERT INTO agents (
      id, tenant_id, name, slug, locale, locale_tone, summary, status,
      pipeline_json, series, carrier, system_prompt, topology, version,
      created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.tenant_id,
    row.name,
    row.slug,
    row.locale,
    row.locale_tone,
    row.summary,
    row.status,
    row.pipeline_json,
    row.series,
    row.carrier,
    row.system_prompt,
    row.topology,
    row.version,
    row.created_at,
    row.updated_at,
    row.published_at,
  )
  return row
}

export function updateAgent(
  tenantId: string,
  agentId: string,
  patch: Partial<Pick<AgentRow, 'name' | 'summary' | 'locale' | 'system_prompt' | 'status'>>,
): AgentRow | undefined {
  const existing = getAgentRow(tenantId, agentId)
  if (!existing) return undefined
  const next = {
    name: patch.name?.trim() || existing.name,
    summary: patch.summary?.trim() ?? existing.summary,
    locale: patch.locale?.trim() || existing.locale,
    system_prompt: patch.system_prompt ?? existing.system_prompt,
    status: (patch.status || existing.status) as AgentStatus,
    updated_at: now(),
    published_at:
      patch.status === 'live' && existing.status !== 'live' ? now() : existing.published_at,
    version: patch.status === 'live' && existing.status !== 'live' ? existing.version + 1 : existing.version,
  }
  getDb()
    .prepare(
      `UPDATE agents SET name = ?, summary = ?, locale = ?, system_prompt = ?,
       status = ?, updated_at = ?, published_at = ?, version = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      next.name,
      next.summary,
      next.locale,
      next.system_prompt,
      next.status,
      next.updated_at,
      next.published_at,
      next.version,
      agentId,
      tenantId,
    )
  return getAgentRow(tenantId, agentId)
}

export function toAgent(row: AgentRow): Agent {
  const pipeline = parsePipeline(row.pipeline_json)
  const stats = agentStats(row.tenant_id, row.id)
  return {
    id: row.id,
    name: row.name,
    locale: row.locale,
    localeTone: row.locale_tone,
    summary: row.summary,
    status: row.status,
    pipeline: [
      pipeline[1]?.model || 'STT',
      pipeline[2]?.model || 'LLM',
      pipeline[3]?.model || 'TTS',
    ],
    series: row.series,
    carrier: row.carrier,
    p95Ms: stats.p95,
    calls7d: stats.calls7d,
    costPerMin: null,
  }
}

function agentStats(tenantId: string, agentId: string): { p95: number | null; calls7d: number } {
  const db = getDb()
  const weekAgo = now() - 7 * 24 * 60 * 60 * 1000
  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM calls
       WHERE tenant_id = ? AND agent_id = ? AND started_at >= ?`,
    )
    .get(tenantId, agentId, weekAgo) as { n: number }
  const samples = db
    .prepare(
      `SELECT t.v2v_ms AS v2v FROM call_turns t
       JOIN calls c ON c.id = t.call_id
       WHERE c.tenant_id = ? AND c.agent_id = ? AND t.v2v_ms IS NOT NULL
       ORDER BY t.v2v_ms`,
    )
    .all(tenantId, agentId) as { v2v: number }[]
  return {
    calls7d: Number(countRow.n) || 0,
    p95: percentile(samples.map((s) => s.v2v), 0.95),
  }
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const i = Math.min(values.length - 1, Math.floor(values.length * p))
  return values[i]
}

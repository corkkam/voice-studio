import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id } from '@/lib/db/ids'
import { replyForEval } from '@/lib/media/complete'
import { resolveSystemPrompt } from '@/lib/store/knowledge'
import { getAgentRow } from '@/lib/store/agents'
import type { AssertionKind, EvalCaseRow, EvalResultRow, EvalRunRow } from '@/lib/store/types'

const KINDS: AssertionKind[] = ['contains', 'not_contains', 'max_sentences']

export const ASSERTION_LABELS: Record<AssertionKind, string> = {
  contains: 'contains',
  not_contains: 'must not contain',
  max_sentences: 'at most N sentences',
}

export function listCases(tenantId: string, agentId: string): Promise<EvalCaseRow[]> {
  return all<EvalCaseRow>(
    'SELECT * FROM eval_cases WHERE tenant_id = ? AND agent_id = ? ORDER BY created_at ASC',
    [tenantId, agentId],
  )
}

export async function countCases(tenantId: string): Promise<number> {
  const found = await one<{ n: number }>('SELECT COUNT(*) AS n FROM eval_cases WHERE tenant_id = ?', [
    tenantId,
  ])
  return Number(found?.n) || 0
}

export async function createCase(
  tenantId: string,
  input: {
    agentId: string
    name: string
    utterance: string
    assertionKind?: string
    assertionValue?: string
    maxMs?: number | null
  },
): Promise<EvalCaseRow | undefined> {
  const agent = await getAgentRow(tenantId, input.agentId)
  if (!agent) return undefined
  const kind = KINDS.includes(input.assertionKind as AssertionKind)
    ? (input.assertionKind as AssertionKind)
    : 'contains'
  const testCase: EvalCaseRow = {
    id: id('evc'),
    tenant_id: tenantId,
    agent_id: input.agentId,
    name: input.name.trim(),
    utterance: input.utterance.trim(),
    assertion_kind: kind,
    assertion_value: (input.assertionValue || '').trim(),
    max_ms: input.maxMs && Number.isFinite(input.maxMs) ? Math.round(input.maxMs) : null,
    created_at: now(),
  }
  await run(
    `INSERT INTO eval_cases (
       id, tenant_id, agent_id, name, utterance, assertion_kind, assertion_value, max_ms, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testCase.id,
      testCase.tenant_id,
      testCase.agent_id,
      testCase.name,
      testCase.utterance,
      testCase.assertion_kind,
      testCase.assertion_value,
      testCase.max_ms,
      testCase.created_at,
    ],
  )
  return testCase
}

export async function deleteCase(tenantId: string, caseId: string): Promise<void> {
  await run('DELETE FROM eval_cases WHERE id = ? AND tenant_id = ?', [caseId, tenantId])
}

export function latestRun(tenantId: string, agentId: string): Promise<EvalRunRow | undefined> {
  return one<EvalRunRow>(
    `SELECT * FROM eval_runs WHERE tenant_id = ? AND agent_id = ?
     AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`,
    [tenantId, agentId],
  )
}

export async function previousRun(
  tenantId: string,
  agentId: string,
): Promise<EvalRunRow | undefined> {
  const runs = await all<EvalRunRow>(
    `SELECT * FROM eval_runs WHERE tenant_id = ? AND agent_id = ?
     AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 2`,
    [tenantId, agentId],
  )
  return runs[1]
}

/** Ordered by seq: Postgres has no implicit row order, so the column carries it. */
export function listResults(runId: string): Promise<EvalResultRow[]> {
  return all<EvalResultRow>('SELECT * FROM eval_results WHERE run_id = ? ORDER BY seq ASC', [runId])
}

export interface RunOutcome {
  runId: string
  passed: number
  total: number
  error?: string
}

/*
 * A run sends every case through the same model path a real turn uses, so the
 * latencies are measured rather than designed. It deliberately does not create a
 * call row: an eval is not traffic, and the live monitor must not fill up with
 * test sessions. Assertions stay deterministic on purpose. A model that grades
 * another model can be wrong, and a gate that can be wrong is worse than none.
 */
export async function runSuite(tenantId: string, agentId: string): Promise<RunOutcome> {
  const agent = await getAgentRow(tenantId, agentId)
  if (!agent) return { runId: '', passed: 0, total: 0, error: 'Agent not found.' }
  const cases = await listCases(tenantId, agentId)
  if (cases.length === 0) {
    return { runId: '', passed: 0, total: 0, error: 'Add a case before running the suite.' }
  }

  const runId = id('evr')
  const started = now()
  await run(
    `INSERT INTO eval_runs (id, tenant_id, agent_id, agent_version, started_at, finished_at, passed, total, p95_ms)
     VALUES (?, ?, ?, ?, ?, NULL, 0, ?, NULL)`,
    [runId, tenantId, agentId, agent.version, started, cases.length],
  )

  const resolved = await resolveSystemPrompt(tenantId, agentId, agent.system_prompt)
  const durations: number[] = []
  let passed = 0
  let seq = 0

  for (const testCase of cases) {
    const began = Date.now()
    let reply = ''
    let detail = ''
    let ok = false
    try {
      const result = await replyForEval({
        tenantId,
        agent,
        system: resolved.system,
        utterance: testCase.utterance,
      })
      reply = result.text
      const verdict = score(testCase, reply, Date.now() - began)
      ok = verdict.pass
      detail = verdict.detail
    } catch (error) {
      detail = error instanceof Error ? error.message.slice(0, 200) : 'Model request failed.'
    }
    const turnMs = Date.now() - began
    durations.push(turnMs)
    if (ok) passed += 1
    seq += 1
    await run(
      `INSERT INTO eval_results (
         id, run_id, seq, case_id, case_name, utterance, assertion, reply, turn_ms, pass, detail
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id('evx'),
        runId,
        seq,
        testCase.id,
        testCase.name,
        testCase.utterance,
        describeAssertion(testCase),
        reply,
        turnMs,
        ok ? 1 : 0,
        detail,
      ],
    )
  }

  await run('UPDATE eval_runs SET finished_at = ?, passed = ?, total = ?, p95_ms = ? WHERE id = ?', [
    now(),
    passed,
    cases.length,
    percentile(durations, 0.95),
    runId,
  ])
  return { runId, passed, total: cases.length }
}

export function describeAssertion(testCase: EvalCaseRow): string {
  const base =
    testCase.assertion_kind === 'contains'
      ? `contains "${testCase.assertion_value}"`
      : testCase.assertion_kind === 'not_contains'
        ? `must not contain "${testCase.assertion_value}"`
        : `at most ${testCase.assertion_value || '1'} sentence(s)`
  return testCase.max_ms ? `${base}, under ${testCase.max_ms} ms` : base
}

function score(
  testCase: EvalCaseRow,
  reply: string,
  elapsedMs: number,
): { pass: boolean; detail: string } {
  if (testCase.max_ms && elapsedMs > testCase.max_ms) {
    return { pass: false, detail: `${elapsedMs} ms over the ${testCase.max_ms} ms limit` }
  }
  const haystack = reply.toLowerCase()
  const needle = testCase.assertion_value.toLowerCase()

  if (testCase.assertion_kind === 'contains') {
    if (!needle) return { pass: false, detail: 'No expected text set on the case.' }
    return haystack.includes(needle)
      ? { pass: true, detail: '' }
      : { pass: false, detail: `Reply is missing "${testCase.assertion_value}"` }
  }
  if (testCase.assertion_kind === 'not_contains') {
    if (!needle) return { pass: false, detail: 'No forbidden text set on the case.' }
    return haystack.includes(needle)
      ? { pass: false, detail: `Reply contains "${testCase.assertion_value}"` }
      : { pass: true, detail: '' }
  }
  const limit = Number(testCase.assertion_value) || 1
  const sentences = countSentences(reply)
  return sentences <= limit
    ? { pass: true, detail: '' }
    : { pass: false, detail: `${sentences} sentences, limit is ${limit}` }
}

function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim().length > 0).length
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[i] ?? null
}

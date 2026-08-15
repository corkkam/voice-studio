import { TopBar } from '@/components/shell/TopBar'
import { EvalsManager } from '@/components/evals/EvalsManager'
import { requireAuth } from '@/lib/auth/session'
import { listAgentSummaries } from '@/lib/store/agents'
import {
  describeAssertion,
  latestRun,
  listCases,
  listResults,
  previousRun,
} from '@/lib/store/evals'

export default async function EvalsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>
}) {
  const auth = await requireAuth()
  const { agent: requested } = await searchParams
  const agents = listAgentSummaries(auth.tenant.id).map((agent) => ({
    id: agent.id,
    name: agent.name,
    version: agent.version,
  }))
  const agentId = agents.find((agent) => agent.id === requested)?.id ?? agents[0]?.id ?? null

  const cases = agentId ? listCases(auth.tenant.id, agentId) : []
  const run = agentId ? latestRun(auth.tenant.id, agentId) : undefined
  const prior = agentId ? previousRun(auth.tenant.id, agentId) : undefined
  const results = run ? listResults(run.id) : []
  // A regression is a case that passed on the previous run and fails on this
  // one. That is the signal worth surfacing, not the raw failure count.
  const priorPassed = new Set(
    (prior ? listResults(prior.id) : []).filter((r) => r.pass === 1).map((r) => r.case_id),
  )

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">Evals</h1>
        <p className="mt-[6px] mb-6 max-w-[680px] font-sans text-[13px] text-muted">
          Scripted turns run through the live model path, scored on deterministic assertions. This is
          a product surface for checking an agent, not a test runner for this repo.
        </p>
        <EvalsManager
          agents={agents}
          agentId={agentId}
          cases={cases.map((testCase) => ({
            id: testCase.id,
            name: testCase.name,
            utterance: testCase.utterance,
            assertion: describeAssertion(testCase),
          }))}
          results={results.map((result) => ({
            caseId: result.case_id,
            caseName: result.case_name,
            utterance: result.utterance,
            assertion: result.assertion,
            reply: result.reply,
            turnMs: result.turn_ms,
            pass: result.pass === 1,
            detail: result.detail,
            regressed: result.pass === 0 && priorPassed.has(result.case_id),
          }))}
          summary={
            run
              ? {
                  passed: run.passed,
                  total: run.total,
                  p95Ms: run.p95_ms,
                  agentVersion: run.agent_version,
                  finishedAt: run.finished_at ?? run.started_at,
                  newFailures: results.filter(
                    (result) => result.pass === 0 && priorPassed.has(result.case_id),
                  ).length,
                  passedDelta: prior ? run.passed - prior.passed : null,
                }
              : null
          }
        />
      </div>
    </>
  )
}

'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Chip, Eyebrow, Input, Meter, Select, TextArea } from '@/components/ui/primitives'
import {
  createCaseAction,
  deleteCaseAction,
  runSuiteAction,
  type FormState,
} from '@/lib/store/actions'

export interface EvalCase {
  id: string
  name: string
  utterance: string
  assertion: string
}

export interface EvalResult {
  caseId: string
  caseName: string
  utterance: string
  assertion: string
  reply: string
  turnMs: number | null
  pass: boolean
  detail: string
  regressed: boolean
}

export interface EvalSummary {
  passed: number
  total: number
  p95Ms: number | null
  agentVersion: number
  finishedAt: number
  newFailures: number
  passedDelta: number | null
}

export interface EvalAgent {
  id: string
  name: string
  version: number
}

const LATENCY_BUDGET_MS = 900

const GRID = 'grid grid-cols-[1.8fr_1.5fr_1.9fr_0.7fr_0.8fr_78px] gap-[13px]'

const ASSERTIONS = [
  { value: 'contains', label: 'reply contains' },
  { value: 'not_contains', label: 'reply must not contain' },
  { value: 'max_sentences', label: 'at most N sentences' },
]

export function EvalsManager({
  agents,
  agentId,
  cases,
  results,
  summary,
}: {
  agents: EvalAgent[]
  agentId: string | null
  cases: EvalCase[]
  results: EvalResult[]
  summary: EvalSummary | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [runState, runAction, running] = useActionState<FormState, FormData>(
    runSuiteAction,
    undefined,
  )

  if (!agentId) {
    return (
      <div className="rounded-[10px] border border-line bg-panel px-4 py-16 text-center">
        <p className="font-sans text-[13px] text-ink-3">No agents to evaluate yet.</p>
        <p className="mt-2 font-sans text-[12px] text-muted">
          Create an agent first. A case runs against its prompt through the live model path.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-[6px]">
            <span className="font-mono text-[9.5px] font-semibold tracking-[0.07em] text-muted-4">
              AGENT
            </span>
            <select
              value={agentId}
              onChange={(event) => router.push(`/evals?agent=${event.target.value}`)}
              className="rounded-[7px] border border-line bg-panel px-[9px] py-[7px] font-sans text-[12.5px] text-ink outline-none focus:border-accent"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} (v{agent.version})
                </option>
              ))}
            </select>
          </label>
          <span className="pb-[8px] font-sans text-[11.5px] text-muted">
            {summary
              ? `Last run ${relative(summary.finishedAt)} on v${summary.agentVersion}`
              : 'Never run'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpen((was) => !was)}>{open ? 'Cancel' : 'New case'}</Button>
          <form action={runAction}>
            <input type="hidden" name="agentId" value={agentId} />
            <Button type="submit" variant="primary" disabled={running || cases.length === 0}>
              {running ? 'Running' : 'Run suite'}
            </Button>
          </form>
        </div>
      </div>

      {runState?.error ? (
        <p className="font-sans text-[11.5px] text-accent-deep">{runState.error}</p>
      ) : null}

      {open ? <CaseForm agentId={agentId} onDone={() => setOpen(false)} /> : null}

      {summary ? <Tiles summary={summary} /> : null}

      {results.length > 0 ? (
        <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
          <div
            className={`${GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
          >
            <div>CASE</div>
            <div>ASSERTION</div>
            <div>REPLY</div>
            <div className="text-right">TURN</div>
            <div className="text-right">RESULT</div>
            <div />
          </div>
          {results.map((result, i) => (
            <div
              key={result.caseId + i}
              className={`${GRID} items-start px-4 py-[12px] ${
                i < results.length - 1 ? 'border-b border-line-4' : ''
              } ${result.pass ? '' : 'bg-accent-tint'}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {result.pass ? null : <span className="h-[6px] w-[6px] rounded-full bg-accent" />}
                  <span className="font-sans text-[12.5px] leading-[1.2] font-semibold text-ink">
                    {result.caseName}
                  </span>
                  {result.regressed ? <Chip tone="accent">new</Chip> : null}
                </div>
                <div className="mt-1 font-mono text-[10.5px] leading-[1.4] text-muted-2">
                  &quot;{result.utterance}&quot;
                </div>
              </div>
              <div className="font-mono text-[10.5px] leading-[1.45] text-muted">
                {result.assertion}
                {result.detail ? (
                  <div className="mt-1 text-accent-deep">{result.detail}</div>
                ) : null}
              </div>
              <div className="font-mono text-[10.5px] leading-[1.45] text-ink-3">
                {result.reply || <span className="text-muted-3">no reply</span>}
              </div>
              <div
                className={`text-right font-mono text-[12px] leading-none ${
                  (result.turnMs ?? 0) > LATENCY_BUDGET_MS
                    ? 'font-semibold text-accent-deep'
                    : 'font-medium text-ink-2'
                }`}
              >
                {result.turnMs === null ? (
                  <span className="text-muted-3">—</span>
                ) : (
                  <>
                    {result.turnMs}
                    <span className="font-normal text-muted-3">ms</span>
                  </>
                )}
              </div>
              <div className="text-right">
                {result.pass ? <Chip tone="good">pass</Chip> : <Chip tone="accent">fail</Chip>}
              </div>
              <div className="flex justify-end">
                <Button
                  className="px-[8px] py-[5px] text-[10.5px]"
                  onClick={() => deleteCaseAction(result.caseId)}
                >
                  Drop
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CaseList cases={cases} />
      )}
    </div>
  )
}

function Tiles({ summary }: { summary: EvalSummary }) {
  const over = (summary.p95Ms ?? 0) > LATENCY_BUDGET_MS
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
        <Eyebrow>PASS RATE</Eyebrow>
        <div className="mt-[9px] flex items-baseline gap-[5px]">
          <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
            {summary.passed}
          </span>
          <span className="font-sans text-[12px] leading-none font-medium text-muted">
            / {summary.total}
          </span>
        </div>
        <div className="mt-[11px]">
          <Meter
            pct={summary.total ? (summary.passed / summary.total) * 100 : 0}
            color="var(--color-good)"
            track="#efe9e1"
            targetPct={100}
          />
        </div>
        <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
          {summary.passedDelta === null
            ? 'First run'
            : summary.passedDelta === 0
              ? 'Level against the last run'
              : `${summary.passedDelta > 0 ? 'Up' : 'Down'} ${Math.abs(summary.passedDelta)} against the last run`}
        </div>
      </div>

      <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
        <Eyebrow>P95 TURN</Eyebrow>
        <div className="mt-[9px] flex items-baseline gap-[5px]">
          <span
            className={`font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] ${
              over ? 'text-accent-deep' : 'text-ink'
            }`}
          >
            {summary.p95Ms ?? '—'}
          </span>
          <span className="font-sans text-[12px] leading-none font-medium text-muted">ms</span>
        </div>
        <div className="mt-[11px]">
          <Meter
            pct={((summary.p95Ms ?? 0) / LATENCY_BUDGET_MS) * 100}
            color={over ? 'var(--color-accent)' : 'var(--color-good)'}
            track="#efe9e1"
            targetPct={100}
          />
        </div>
        <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
          {over ? `Over the ${LATENCY_BUDGET_MS} ms budget` : `Inside the ${LATENCY_BUDGET_MS} ms budget`}
        </div>
      </div>

      <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
        <Eyebrow>NEW FAILURES</Eyebrow>
        <div
          className={`mt-[9px] font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] ${
            summary.newFailures > 0 ? 'text-accent-deep' : 'text-ink'
          }`}
        >
          {summary.newFailures}
        </div>
        <div className="mt-[7px] font-sans text-[11px] leading-[1.4] text-muted-2">
          Passed on the last run and fails now
        </div>
      </div>

      <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
        <Eyebrow>MEASURED HOW</Eyebrow>
        <div className="mt-[9px] font-sans text-[12px] leading-[1.45] text-ink-3">
          Every case goes through the live model path, with the same resolved prompt a real turn uses.
        </div>
        <div className="mt-[7px] font-sans text-[11px] leading-[1.4] text-muted-2">
          No call row is created, so the monitor stays clean.
        </div>
      </div>
    </div>
  )
}

function CaseList({ cases }: { cases: EvalCase[] }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
      {cases.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="font-sans text-[13px] text-ink-3">No cases for this agent.</p>
          <p className="mt-2 mx-auto max-w-[440px] font-sans text-[12px] text-muted">
            A case is one thing the caller says plus one assertion about the reply. Write the ones you
            would be embarrassed to get wrong, then run the suite after every prompt edit.
          </p>
        </div>
      ) : (
        cases.map((testCase, i) => (
          <div
            key={testCase.id}
            className={`flex items-start justify-between gap-4 px-4 py-[12px] ${
              i < cases.length - 1 ? 'border-b border-line-4' : ''
            }`}
          >
            <div className="min-w-0">
              <div className="font-sans text-[12.5px] font-semibold text-ink">{testCase.name}</div>
              <div className="mt-1 font-mono text-[10.5px] text-muted-2">
                &quot;{testCase.utterance}&quot;
              </div>
              <div className="mt-1 font-mono text-[10.5px] text-muted">{testCase.assertion}</div>
            </div>
            <Button
              className="flex-none px-[9px] py-[6px] text-[11px]"
              onClick={() => deleteCaseAction(testCase.id)}
            >
              Drop
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

function CaseForm({ agentId, onDone }: { agentId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createCaseAction,
    undefined,
  )

  return (
    <form
      action={async (form) => {
        await formAction(form)
        onDone()
      }}
      className="rounded-[9px] border border-line bg-panel p-[14px_15px]"
    >
      <input type="hidden" name="agentId" value={agentId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label="Case name" name="name" placeholder="Asks for a refund window" />
        <Input label="Max turn (ms, optional)" name="maxMs" type="number" placeholder="900" />
      </div>
      <div className="mt-3">
        <TextArea
          label="What the caller says"
          name="utterance"
          rows={2}
          placeholder="When do I get my money back"
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
        <Select label="Assertion" name="assertionKind" options={ASSERTIONS} defaultValue="contains" />
        <Input label="Expected value" name="assertionValue" placeholder="5 to 7" />
      </div>
      {state?.error ? (
        <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving' : 'Create case'}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

function relative(at: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

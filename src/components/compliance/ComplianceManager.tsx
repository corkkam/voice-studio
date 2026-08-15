'use client'

import { useActionState, useState } from 'react'
import { Button, Chip, Eyebrow, Input, TextArea } from '@/components/ui/primitives'
import { purgeExpiredAction, savePolicyAction, type FormState } from '@/lib/store/actions'

export interface PolicyCard {
  agentId: string
  agentName: string
  status: 'live' | 'draft'
  calls: number
  disclosure: string
  retentionDays: number
  redactPii: boolean
}

export interface Enforcement {
  title: string
  detail: string
}

const GRID = 'grid grid-cols-[1.4fr_1.8fr_0.8fr_0.8fr_0.9fr_74px] gap-[13px]'

export function ComplianceManager({
  policies,
  held,
  expired,
  enforced,
  intentOnly,
}: {
  policies: PolicyCard[]
  held: number
  expired: number
  enforced: Enforcement[]
  intentOnly: Enforcement[]
}) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
          <div
            className={`${GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
          >
            <div>AGENT</div>
            <div>DISCLOSURE</div>
            <div className="text-right">RETENTION</div>
            <div className="text-right">REDACT PII</div>
            <div className="text-right">STATE</div>
            <div />
          </div>

          {policies.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="font-sans text-[13px] text-ink-3">No agents to govern yet.</p>
              <p className="mt-2 font-sans text-[12px] text-muted">
                A policy is per agent, so this fills in as you create them.
              </p>
            </div>
          ) : (
            policies.map((policy, i) => {
              const gap = policy.status === 'live' && !policy.disclosure
              return (
                <div
                  key={policy.agentId}
                  className={i < policies.length - 1 ? 'border-b border-line-4' : ''}
                >
                  <div className={`${GRID} items-center px-4 py-[12px] ${gap ? 'bg-accent-tint' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-[6px] w-[6px] rounded-full ${
                            gap ? 'bg-accent' : policy.status === 'live' ? 'bg-good' : 'bg-faint-3'
                          }`}
                        />
                        <span
                          className={`font-sans text-[13px] leading-[1.2] font-semibold ${
                            policy.status === 'live' ? 'text-ink' : 'text-ink-3'
                          }`}
                        >
                          {policy.agentName}
                        </span>
                      </div>
                      <div className="mt-1 font-sans text-[11.5px] leading-[1.3] text-muted-2">
                        {policy.status}, {policy.calls.toLocaleString('en-US')} call
                        {policy.calls === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div
                      className={`font-mono text-[10.5px] leading-[1.45] ${
                        policy.disclosure
                          ? 'text-muted'
                          : policy.status === 'live'
                            ? 'font-semibold text-accent-deep'
                            : 'text-muted-3'
                      }`}
                    >
                      {policy.disclosure ||
                        (policy.status === 'live'
                          ? 'no disclosure set'
                          : 'not required while draft')}
                    </div>
                    <div className="text-right font-mono text-[12.5px] leading-none font-medium text-ink-2">
                      {policy.retentionDays}
                      <span className="text-muted-3">d</span>
                    </div>
                    <div className="text-right">
                      {policy.redactPii ? <Chip tone="good">on</Chip> : <Chip>off</Chip>}
                    </div>
                    <div className="text-right">
                      {policy.status === 'draft' ? (
                        <Chip tone="outline">draft</Chip>
                      ) : gap ? (
                        <Chip tone="accent">gap</Chip>
                      ) : (
                        <Chip tone="good">complete</Chip>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        className="px-[9px] py-[6px] text-[11px]"
                        onClick={() => setEditing(editing === policy.agentId ? null : policy.agentId)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                  {editing === policy.agentId ? (
                    <div className="border-t border-line-4 bg-panel-2 px-4 py-[14px]">
                      <PolicyForm policy={policy} onDone={() => setEditing(null)} />
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <RetentionPanel held={held} expired={expired} />
      </div>

      <div className="flex flex-col gap-3">
        <EnforcementPanel
          title="ENFORCED IN CODE"
          items={enforced}
          tone="good"
          note="Each of these is a real code path, not a setting."
        />
        <EnforcementPanel
          title="RECORDED INTENT ONLY"
          items={intentOnly}
          tone="warn"
          note="Everything in this box is a promise the runtime does not keep yet. It is labelled so on purpose."
        />
      </div>
    </div>
  )
}

function PolicyForm({ policy, onDone }: { policy: PolicyCard; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    savePolicyAction,
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
      <input type="hidden" name="agentId" value={policy.agentId} />
      <TextArea
        label="Disclosure line"
        name="disclosure"
        rows={2}
        defaultValue={policy.disclosure}
        placeholder="This call uses an automated assistant and is recorded."
      />
      <p className="mt-[6px] font-sans text-[11px] leading-[1.45] text-muted-2">
        Returned to the client on the session response. The client must play it. Nothing on the
        control plane can make that happen.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          label="Retention (days)"
          name="retentionDays"
          type="number"
          defaultValue={policy.retentionDays}
        />
        <div className="flex items-end pb-[7px]">
          <label className="flex items-center gap-[7px] font-sans text-[12px] text-ink-2">
            <input
              name="redactPii"
              type="checkbox"
              defaultChecked={policy.redactPii}
              className="h-[13px] w-[13px] accent-accent"
            />
            Redact PII on new turns
          </label>
        </div>
      </div>
      {state?.error ? (
        <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving' : 'Save policy'}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

/*
 * Retention is a recorded number with no job behind it, so this panel reports the
 * gap between the policy and the disk and gives one explicit way to close it.
 * Deleting audit rows is never optimistic: it asks first and reports what went.
 */
function RetentionPanel({ held, expired }: { held: number; expired: number }) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    purgeExpiredAction,
    undefined,
  )

  return (
    <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
      <Eyebrow>RETENTION, MEASURED</Eyebrow>
      <div className="mt-[11px] flex flex-wrap items-end gap-7">
        <Figure value={held} label="calls held" />
        <Figure value={expired} label="past their window" alert={expired > 0} />
        <Figure value={0} label="deleted by a job" />
        <div className="ml-auto flex items-center gap-2">
          {confirming ? (
            <form action={formAction} className="flex items-center gap-2">
              <span className="font-sans text-[11.5px] font-semibold text-ink">
                Delete {expired} call{expired === 1 ? '' : 's'} for good?
              </span>
              <Button type="submit" variant="dark" disabled={pending}>
                {pending ? 'Deleting' : 'Yes, delete'}
              </Button>
              <Button onClick={() => setConfirming(false)}>No</Button>
            </form>
          ) : (
            <Button variant="dark" disabled={expired === 0} onClick={() => setConfirming(true)}>
              {expired === 0 ? 'Nothing to purge' : `Purge ${expired} now`}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-[11px] font-sans text-[11.5px] leading-[1.45] text-muted">
        {state?.note
          ? state.note
          : expired === 0
            ? 'No call is past its window. There is still no scheduled job, so this stays a manual check.'
            : `${expired} call${expired === 1 ? ' is' : 's are'} past their window and still on disk. This button is the only thing that deletes them today.`}
      </p>
    </div>
  )
}

function Figure({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div>
      <div
        className={`font-sans text-[24px] leading-none font-semibold tracking-[-0.5px] ${
          alert ? 'text-accent-deep' : 'text-ink'
        }`}
      >
        {value.toLocaleString('en-US')}
      </div>
      <div className="mt-[6px] font-sans text-[11px] leading-none text-muted-2">{label}</div>
    </div>
  )
}

function EnforcementPanel({
  title,
  items,
  tone,
  note,
}: {
  title: string
  items: Enforcement[]
  tone: 'good' | 'warn'
  note: string
}) {
  const box =
    tone === 'good'
      ? 'border-good-line bg-good-tint'
      : 'border-accent-line bg-accent-tint-2'
  const dot = tone === 'good' ? 'bg-good' : 'bg-accent'

  return (
    <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-[10px] flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.title}
            className={`flex items-start gap-[10px] rounded-[8px] border px-[11px] py-[10px] ${box}`}
          >
            <span className={`mt-px h-[14px] w-[14px] flex-none rounded-[4px] ${dot}`} />
            <div>
              <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
                {item.title}
              </div>
              <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-[11px] font-sans text-[11px] leading-[1.45] text-muted-2">{note}</p>
    </div>
  )
}

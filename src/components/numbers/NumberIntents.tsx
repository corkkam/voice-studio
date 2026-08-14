'use client'

import { useActionState, useState } from 'react'
import { Button, Chip, Eyebrow, Input, Select } from '@/components/ui/primitives'
import {
  createNumberIntentAction,
  deleteNumberIntentAction,
  type FormState,
} from '@/lib/store/actions'

export interface IntentCard {
  id: string
  name: string
  note: string
  kindLabel: string
  agentName: string | null
  region: string
}

export interface IntentAgent {
  id: string
  name: string
}

const GRID = 'grid grid-cols-[1.5fr_1fr_1.2fr_0.9fr_1fr_86px] gap-[13px]'

const KINDS = [
  { value: 'did_inbound', label: 'DID inbound' },
  { value: 'sip_outbound', label: 'SIP outbound' },
  { value: 'sip_inbound', label: 'SIP inbound' },
]

const REGIONS = ['IN-SOUTH', 'IN-WEST', 'US-EAST', 'EU-WEST'].map((value) => ({
  value,
  label: value,
}))

export function NumberIntents({
  intents,
  agents,
}: {
  intents: IntentCard[]
  agents: IntentAgent[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createNumberIntentAction,
    undefined,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Eyebrow>
          {intents.length} RECORDED INTENT{intents.length === 1 ? '' : 'S'}
        </Eyebrow>
        <Button onClick={() => setOpen((was) => !was)}>{open ? 'Cancel' : 'Add intent'}</Button>
      </div>

      {open ? (
        <form
          action={async (form) => {
            await formAction(form)
            setOpen(false)
          }}
          className="rounded-[9px] border border-line bg-panel p-[14px_15px]"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input label="Name" name="name" placeholder="Support line" />
            <Select label="Kind" name="kind" options={KINDS} defaultValue="did_inbound" />
            <Select
              label="Answered by"
              name="agentId"
              options={[
                { value: '', label: 'unassigned' },
                ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
              ]}
            />
            <Select label="Region" name="region" options={REGIONS} defaultValue="IN-SOUTH" />
          </div>
          <div className="mt-3">
            <Input label="Note" name="note" placeholder="Local number, Bengaluru" />
          </div>
          {state?.error ? (
            <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving' : 'Record intent'}
            </Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        <div
          className={`${GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
        >
          <div>INTENT</div>
          <div>KIND</div>
          <div>ANSWERED BY</div>
          <div>REGION</div>
          <div>STATE</div>
          <div />
        </div>

        {intents.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-sans text-[13px] text-ink-3">Nothing recorded yet.</p>
            <p className="mt-2 mx-auto max-w-[420px] font-sans text-[12px] text-muted">
              Record the numbers and trunks you mean to provision. Day one of real telephony then
              has somewhere to land.
            </p>
          </div>
        ) : (
          intents.map((intent, i) => (
            <div
              key={intent.id}
              className={`${GRID} items-center px-4 py-[12px] ${
                i < intents.length - 1 ? 'border-b border-line-4' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full bg-faint-3" />
                  <span className="font-sans text-[13px] leading-[1.2] font-semibold text-ink-3">
                    {intent.name}
                  </span>
                </div>
                {intent.note ? (
                  <div className="mt-1 font-sans text-[11.5px] leading-[1.3] text-muted-2">
                    {intent.note}
                  </div>
                ) : null}
              </div>
              <div>
                <Chip tone="outline">{intent.kindLabel}</Chip>
              </div>
              <div className="font-mono text-[11px] text-muted">
                {intent.agentName ?? <span className="text-muted-3">unassigned</span>}
              </div>
              <div className="font-mono text-[11px] text-muted">{intent.region}</div>
              <div>
                <Chip>not provisioned</Chip>
              </div>
              <div className="flex justify-end">
                <Button
                  className="px-[9px] py-[6px] text-[11px]"
                  onClick={() => deleteNumberIntentAction(intent.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

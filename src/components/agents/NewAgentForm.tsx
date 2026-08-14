'use client'

import { useActionState } from 'react'
import { createAgentAction } from '@/lib/store/actions'
import { Button } from '@/components/ui/primitives'
import { Field } from '@/components/auth/LoginForm'

export function NewAgentForm() {
  const [state, action, pending] = useActionState(createAgentAction, undefined)

  return (
    <form action={action} className="flex max-w-[560px] flex-col gap-4">
      <Field label="Name" name="name" />
      <Field label="Locale" name="locale" defaultValue="en" />
      <label className="flex flex-col gap-[7px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">SUMMARY</span>
        <input
          name="summary"
          className="rounded-[7px] border border-line bg-panel px-3 py-[10px] font-sans text-[13px] text-ink outline-none focus:border-accent"
          placeholder="What this agent does"
        />
      </label>
      <label className="flex flex-col gap-[7px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">
          SYSTEM PROMPT
        </span>
        <textarea
          name="prompt"
          rows={8}
          className="rounded-[7px] border border-line bg-panel px-3 py-[10px] font-mono text-[12px] leading-[1.55] text-ink outline-none focus:border-accent"
          placeholder="You are a concise voice assistant…"
        />
      </label>
      {state?.error ? <p className="font-sans text-[12px] text-accent-deep">{state.error}</p> : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create agent'}
        </Button>
      </div>
    </form>
  )
}

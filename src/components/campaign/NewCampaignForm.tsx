'use client'

import { useActionState } from 'react'
import { createCampaignAction } from '@/lib/store/actions'
import { Button } from '@/components/ui/primitives'

export function NewCampaignForm({ agents }: { agents: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createCampaignAction, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-[9px] border border-line bg-panel p-4">
      <label className="flex min-w-[220px] flex-1 flex-col gap-[6px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">NAME</span>
        <input
          name="name"
          required
          className="rounded-[6px] border border-line px-3 py-[8px] font-sans text-[13px] outline-none focus:border-accent"
        />
      </label>
      <label className="flex min-w-[200px] flex-col gap-[6px]">
        <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">AGENT</span>
        <select name="agentId" className="rounded-[6px] border border-line bg-panel px-3 py-[8px] font-sans text-[13px]">
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create campaign'}
      </Button>
      {state?.error ? <p className="w-full font-sans text-[12px] text-accent-deep">{state.error}</p> : null}
    </form>
  )
}

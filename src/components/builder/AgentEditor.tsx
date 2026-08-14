'use client'

import { useActionState } from 'react'
import { publishAgentAction, saveAgentAction } from '@/lib/store/actions'
import { Button } from '@/components/ui/primitives'

export function SavePromptForm({
  agentId,
  name,
  locale,
  summary,
  prompt,
}: {
  agentId: string
  name: string
  locale: string
  summary: string
  prompt: string
}) {
  const [state, action, pending] = useActionState(saveAgentAction, undefined)

  return (
    <form action={action} className="overflow-hidden rounded-[9px] border border-line bg-panel">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="summary" value={summary} />
      <div className="flex items-center justify-between border-b border-line-3 px-[14px] py-[11px]">
        <span className="font-sans text-[12px] leading-none font-semibold text-ink">System prompt</span>
        <Button type="submit" variant="ghost" className="px-2 py-[5px] text-[11px]" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <textarea
        name="prompt"
        defaultValue={prompt}
        rows={8}
        className="w-full resize-y bg-transparent px-[14px] py-[13px] font-mono text-[12px] leading-[1.65] text-ink-2 outline-none"
      />
      {state?.error ? (
        <p className="px-[14px] pb-3 font-sans text-[11px] text-accent-deep">{state.error}</p>
      ) : null}
    </form>
  )
}

export function PublishButton({ agentId, live }: { agentId: string; live: boolean }) {
  return (
    <form action={publishAgentAction.bind(null, agentId)}>
      <Button type="submit" variant="primary" className="px-[13px] py-[7px] text-[11.5px]" disabled={live}>
        {live ? 'Published' : 'Publish'}
      </Button>
    </form>
  )
}

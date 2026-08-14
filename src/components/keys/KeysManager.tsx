'use client'

import { useActionState } from 'react'
import { createKeyAction, revokeKeyAction } from '@/lib/store/actions'
import { Button } from '@/components/ui/primitives'

export function KeysManager({
  keys,
}: {
  keys: {
    id: string
    name: string
    prefix: string
    kind: string
    created_at: number
    last_used_at: number | null
    revoked_at: number | null
  }[]
}) {
  const [state, action, pending] = useActionState(createKeyAction, undefined)

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-wrap items-end gap-3 rounded-[9px] border border-line bg-panel p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-[6px]">
          <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">NAME</span>
          <input
            name="name"
            placeholder="Production Mac app"
            className="rounded-[6px] border border-line px-3 py-[8px] font-sans text-[13px] outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">KIND</span>
          <select
            name="kind"
            className="rounded-[6px] border border-line bg-panel px-3 py-[8px] font-sans text-[13px]"
          >
            <option value="secret">Secret · Mac / server</option>
            <option value="publishable">Publishable · web widget</option>
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create key'}
        </Button>
      </form>

      {state?.secret ? (
        <div className="rounded-[9px] border border-accent-line bg-accent-tint px-4 py-3">
          <div className="font-sans text-[12px] font-semibold text-accent-deep">Copy this key now</div>
          <p className="mt-1 font-sans text-[11.5px] text-muted">It will not be shown again.</p>
          <code className="mt-2 block break-all font-mono text-[12px] text-ink">{state.secret}</code>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] gap-3 border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] font-semibold tracking-[0.07em] text-muted-4">
          <div>NAME</div>
          <div>PREFIX</div>
          <div>KIND</div>
          <div>LAST USED</div>
          <div />
        </div>
        {keys.length === 0 ? (
          <div className="px-4 py-12 text-center font-sans text-[13px] text-muted">
            No keys yet. Create a publishable key for the web widget and a secret key for a Mac app.
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.6fr] items-center gap-3 border-b border-line-4 px-4 py-3 last:border-b-0"
            >
              <div className="font-sans text-[13px] font-semibold text-ink">{key.name}</div>
              <div className="font-mono text-[12px] text-ink-3">{key.prefix}…</div>
              <div className="font-mono text-[11px] text-muted">{key.kind}</div>
              <div className="font-mono text-[11px] text-muted">
                {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'never'}
              </div>
              <div className="text-right">
                {key.revoked_at ? (
                  <span className="font-mono text-[11px] text-muted-3">revoked</span>
                ) : (
                  <form action={revokeKeyAction.bind(null, key.id)}>
                    <button type="submit" className="font-sans text-[11px] font-semibold text-accent-deep">
                      Revoke
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

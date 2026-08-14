'use client'

import { useState } from 'react'
import { AgentOrb } from '@/components/orb/AgentOrb'
import type { CallActivity } from '@/lib/activity'

export function WidgetClient({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [apiKey, setApiKey] = useState('')
  const [text, setText] = useState('')
  const [activity, setActivity] = useState<CallActivity>('idle')
  const [log, setLog] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<{ id: string; token: string } | null>(null)

  async function ensureSession() {
    if (session) return session
    const res = await fetch('/api/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId, channel: 'web', display: 'Widget visitor' }),
    })
    const data = (await res.json()) as { id?: string; token?: string; error?: string }
    if (!res.ok || !data.id || !data.token) throw new Error(data.error || 'Could not connect')
    const next = { id: data.id, token: data.token }
    setSession(next)
    return next
  }

  async function send() {
    const value = text.trim()
    if (!value) return
    setText('')
    setError(null)
    try {
      setActivity('connecting')
      const open = await ensureSession()
      setActivity('thinking')
      setLog((prev) => [...prev, `You · ${value}`])
      const res = await fetch('/api/media/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: open.id, token: open.token, text: value }),
      })
      const data = (await res.json()) as { reply?: string; error?: string }
      if (!res.ok || !data.reply) throw new Error(data.error || 'Reply failed')
      setLog((prev) => [...prev, `${agentName} · ${data.reply}`])
      setActivity('listening')
      if ('speechSynthesis' in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.reply))
      }
    } catch (err) {
      setActivity('idle')
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-[12px] border border-line bg-panel p-5 shadow-[0_8px_24px_rgba(0,0,0,.08)]">
      <div className="mb-4 flex items-center gap-3">
        <AgentOrb activity={activity} size={64} paused={activity === 'idle'} />
        <div>
          <div className="font-sans text-[15px] font-semibold text-ink">{agentName}</div>
          <div className="mt-1 font-mono text-[11px] text-muted">Web widget</div>
        </div>
      </div>
      {!session ? (
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="vs_pk_live_… or vs_sk_live_…"
          className="mb-3 w-full rounded-[7px] border border-line px-3 py-[9px] font-mono text-[12px] outline-none focus:border-accent"
        />
      ) : null}
      <div className="mb-3 max-h-[220px] overflow-y-auto font-sans text-[13px] leading-[1.5] text-ink-2">
        {log.length === 0 ? <p className="text-muted">Paste a key, then talk.</p> : log.map((line) => <p key={line}>{line}</p>)}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-[7px] border border-line px-3 py-[9px] font-sans text-[13px] outline-none focus:border-accent"
          placeholder="Type to talk"
        />
        <button type="submit" className="rounded-[7px] bg-accent px-3 py-[9px] font-sans text-[12px] font-semibold text-white">
          Send
        </button>
      </form>
      {error ? <p className="mt-2 font-sans text-[12px] text-accent-deep">{error}</p> : null}
    </div>
  )
}

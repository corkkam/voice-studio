'use client'

import { useEffect, useRef, useState } from 'react'
import { AgentOrb } from '@/components/orb/AgentOrb'
import { ACTIVITY, type CallActivity } from '@/lib/activity'
import { Eyebrow } from '@/components/ui/primitives'

interface Turn {
  speaker: 'AGENT' | 'CALLER'
  text: string
  at: string
}

export function TestCallPanel({ agentId }: { agentId: string }) {
  const [running, setRunning] = useState(false)
  const [activity, setActivity] = useState<CallActivity>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const session = useRef<{ id: string; token: string } | null>(null)
  const started = useRef<number>(0)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  async function start() {
    setError(null)
    const res = await fetch('/api/internal/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    })
    const data = (await res.json()) as { id?: string; token?: string; error?: string }
    if (!res.ok || !data.id || !data.token) {
      setError(data.error || 'Could not start a session')
      return
    }
    session.current = { id: data.id, token: data.token }
    started.current = Date.now()
    setSeconds(0)
    setTurns([])
    setRunning(true)
    setActivity('listening')
  }

  async function stop() {
    if (session.current) {
      await fetch(`/api/internal/sessions/${session.current.id}`, { method: 'DELETE' })
    }
    session.current = null
    setRunning(false)
    setActivity('idle')
  }

  async function send() {
    const value = text.trim()
    if (!value || !session.current) return
    setText('')
    setActivity('thinking')
    const at = clock(Date.now() - started.current)
    setTurns((prev) => [...prev, { speaker: 'CALLER', text: value, at }])
    const res = await fetch('/api/media/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.current.id, token: session.current.token, text: value }),
    })
    const data = (await res.json()) as { reply?: string; error?: string }
    if (!res.ok || !data.reply) {
      setError(data.error || 'Reply failed')
      setActivity('listening')
      return
    }
    setTurns((prev) => [...prev, { speaker: 'AGENT', text: data.reply!, at: clock(Date.now() - started.current) }])
    setActivity('listening')
    speak(data.reply)
  }

  const view = ACTIVITY[activity]
  const clockLabel = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <>
      <div className="font-sans text-[12px] leading-none font-semibold text-ink">Test in browser</div>

      <div className="flex flex-col items-center gap-3 rounded-[9px] border border-line-3 bg-panel-2 p-4">
        <AgentOrb activity={activity} size={64} paused={!running} />
        <div className="text-center">
          <div className="font-sans text-[12px] leading-none font-semibold text-ink">
            {running ? view.label : 'Session stopped'}
          </div>
          <div className="mt-[6px] font-mono text-[11px] leading-none font-medium text-muted-2">
            {clockLabel} · appears on the live monitor
          </div>
        </div>
        <button
          type="button"
          onClick={() => void (running ? stop() : start())}
          className="w-full rounded-[6px] bg-ink px-3 py-[9px] text-center font-sans text-[11.5px] leading-none font-semibold text-white"
        >
          {running ? 'Hang up' : 'Start test session'}
        </button>
      </div>

      {running ? (
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
            placeholder="Speak by typing…"
            className="min-w-0 flex-1 rounded-[6px] border border-line px-3 py-[8px] font-sans text-[12px] text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-[6px] bg-accent px-3 py-[8px] font-sans text-[11.5px] font-semibold text-white"
          >
            Send
          </button>
        </form>
      ) : null}

      {error ? <p className="font-sans text-[11.5px] text-accent-deep">{error}</p> : null}

      <Eyebrow>LIVE TRANSCRIPT</Eyebrow>
      {turns.length === 0 ? (
        <p className="font-sans text-[12px] text-muted">
          Start a session and send a line. The same call shows up under Live calls.
        </p>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {turns.map((turn, i) => (
            <div key={`${turn.at}-${i}`}>
              <div
                className={`mb-1 font-mono text-[9.5px] leading-none font-medium ${
                  turn.speaker === 'AGENT' ? 'text-accent-deep' : 'text-muted-2'
                }`}
              >
                {turn.speaker} · {turn.at}
              </div>
              <div className="font-sans text-[12px] leading-[1.5] text-ink-2">{turn.text}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

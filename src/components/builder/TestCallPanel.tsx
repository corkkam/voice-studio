'use client'

import { useEffect, useRef, useState } from 'react'
import { AgentOrb } from '@/components/orb/AgentOrb'
import { ACTIVITY, type CallActivity } from '@/lib/activity'
import { TEST_TRANSCRIPT } from '@/lib/data/builder'
import { Eyebrow } from '@/components/ui/primitives'

/**
 * The in-browser test call.
 *
 * The mockup drew this as bouncing bars, which animate identically whether the
 * agent is listening, thinking or talking. Here the orb walks the actual turn
 * cycle, so the thing you are testing — where the 800 ms budget is going — is
 * legible without reading the numbers.
 */
const CYCLE: { activity: CallActivity; holdMs: number }[] = [
  { activity: 'listening', holdMs: 2600 },
  { activity: 'thinking', holdMs: 900 },
  { activity: 'tool', holdMs: 700 },
  { activity: 'speaking', holdMs: 3400 },
]

export function TestCallPanel() {
  const [running, setRunning] = useState(true)
  const [step, setStep] = useState(0)
  const [seconds, setSeconds] = useState(41)
  const stepRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running) return
    let timer: number
    const advance = () => {
      stepRef.current = (stepRef.current + 1) % CYCLE.length
      setStep(stepRef.current)
      timer = window.setTimeout(advance, CYCLE[stepRef.current].holdMs)
    }
    timer = window.setTimeout(advance, CYCLE[stepRef.current].holdMs)
    return () => window.clearTimeout(timer)
  }, [running])

  const activity = running ? CYCLE[step].activity : 'idle'
  const view = ACTIVITY[activity]
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <>
      <div className="font-sans text-[12px] leading-none font-semibold text-ink">
        Test in browser
      </div>

      <div className="flex flex-col items-center gap-3 rounded-[9px] border border-line-3 bg-panel-2 p-4">
        <AgentOrb activity={activity} size={64} paused={!running} />

        <div className="text-center">
          <div className="font-sans text-[12px] leading-none font-semibold text-ink">
            {running ? view.label : 'Session stopped'}
          </div>
          <div className="mt-[6px] font-mono text-[11px] leading-none font-medium text-muted-2">
            {clock} · 512 ms last turn
          </div>
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex-1 rounded-[6px] bg-ink px-3 py-[9px] text-center font-sans text-[11.5px] leading-none font-semibold text-white"
          >
            {running ? 'Stop' : 'Start'}
          </button>
          <button
            type="button"
            className="flex-1 rounded-[6px] border border-[#ddd7ce] px-3 py-[9px] text-center font-sans text-[11.5px] leading-none font-semibold text-ink-2 hover:bg-panel-2"
          >
            Call my phone
          </button>
        </div>
      </div>

      <Eyebrow>LIVE TRANSCRIPT</Eyebrow>

      <div className="flex flex-col gap-[10px]">
        {TEST_TRANSCRIPT.map((turn, i) => (
          <div key={i}>
            <div
              className={`mb-1 font-mono text-[9.5px] leading-none font-medium ${
                turn.speaker === 'AGENT' ? 'text-accent-deep' : 'text-muted-2'
              }`}
            >
              {turn.speaker} · {turn.at}
            </div>
            <div className="font-sans text-[12px] leading-[1.5] text-ink-2">{turn.text}</div>
            {turn.tool ? (
              <div className="mt-[6px] inline-flex items-center gap-[5px] rounded-[4px] bg-line-5 px-[6px] py-1 font-mono text-[10px] leading-none font-medium text-ink-3">
                {turn.tool}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  )
}

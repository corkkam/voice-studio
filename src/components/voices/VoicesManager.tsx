'use client'

import { useActionState, useState } from 'react'
import { Button, Chip, Eyebrow, Input, Select, TextArea } from '@/components/ui/primitives'
import {
  bindAgentVoiceAction,
  createVoiceAction,
  deleteVoiceAction,
  setDefaultVoiceAction,
  updateVoiceAction,
  type FormState,
} from '@/lib/store/actions'

export interface VoiceCard {
  id: string
  name: string
  locale: string
  familyHint: string
  rate: number
  pitch: number
  note: string
  isDefault: boolean
  agentCount: number
}

export interface VoiceAgent {
  id: string
  name: string
  voiceId: string | null
}

const GRID = 'grid grid-cols-[1.9fr_0.8fr_1.2fr_0.6fr_0.6fr_0.9fr_170px] gap-[13px]'

const LOCALES = ['en-IN', 'en-US', 'en-GB', 'hi-IN', 'ta-IN', 'te-IN', 'mr-IN'].map((value) => ({
  value,
  label: value,
}))

const FAMILIES = ['any', 'female / neutral', 'female / warm', 'male / neutral', 'male / warm'].map(
  (value) => ({ value, label: value }),
)

export function VoicesManager({
  voices,
  agents,
}: {
  voices: VoiceCard[]
  agents: VoiceAgent[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Eyebrow>{voices.length} PRESET{voices.length === 1 ? '' : 'S'}</Eyebrow>
        <Button variant="primary" onClick={() => setOpen((was) => !was)}>
          {open ? 'Cancel' : 'New preset'}
        </Button>
      </div>

      {open ? <PresetForm onDone={() => setOpen(false)} /> : null}

      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        <div
          className={`${GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
        >
          <div>PRESET</div>
          <div>LOCALE</div>
          <div>FAMILY HINT</div>
          <div className="text-right">RATE</div>
          <div className="text-right">PITCH</div>
          <div>USED BY</div>
          <div />
        </div>

        {voices.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-sans text-[13px] text-ink-3">No voice presets yet.</p>
            <p className="mt-2 font-sans text-[12px] text-muted">
              Speech runs on the caller device, so a preset is a locale, a rate and a family hint
              that the client resolves against a real device voice.
            </p>
          </div>
        ) : (
          voices.map((voice, i) => (
            <div key={voice.id} className={i < voices.length - 1 ? 'border-b border-line-4' : ''}>
              <div className={`${GRID} items-center px-4 py-[12px]`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-[6px] w-[6px] rounded-full ${
                        voice.agentCount > 0 || voice.isDefault ? 'bg-good' : 'bg-faint-3'
                      }`}
                    />
                    <span className="font-sans text-[13px] leading-[1.2] font-semibold text-ink">
                      {voice.name}
                    </span>
                    {voice.isDefault ? <Chip tone="accent">default</Chip> : null}
                    {isRiskyLocale(voice.locale) ? <Chip tone="accent">device may substitute</Chip> : null}
                  </div>
                  {voice.note ? (
                    <div className="mt-1 font-sans text-[11.5px] leading-[1.3] text-muted-2">
                      {voice.note}
                    </div>
                  ) : null}
                </div>
                <div>
                  <Chip tone="outline">{voice.locale}</Chip>
                </div>
                <div className="font-mono text-[11px] text-muted">{voice.familyHint}</div>
                <div className="text-right font-mono text-[12.5px] leading-none font-medium text-ink-2">
                  {voice.rate.toFixed(2)}
                  <span className="text-muted-3">x</span>
                </div>
                <div className="text-right font-mono text-[12.5px] leading-none font-medium text-ink-2">
                  {voice.pitch.toFixed(2)}
                </div>
                <div className="font-mono text-[11px] text-muted">
                  {voice.agentCount === 0 ? (
                    <span className="text-muted-3">not bound</span>
                  ) : (
                    `${voice.agentCount} agent${voice.agentCount === 1 ? '' : 's'}`
                  )}
                </div>
                <div className="flex justify-end gap-[6px]">
                  <PreviewButton voice={voice} />
                  <Button
                    className="px-[9px] py-[6px] text-[11px]"
                    onClick={() => setEditing(editing === voice.id ? null : voice.id)}
                  >
                    Edit
                  </Button>
                </div>
              </div>

              {editing === voice.id ? (
                <div className="border-t border-line-4 bg-panel-2 px-4 py-[14px]">
                  <PresetForm voice={voice} onDone={() => setEditing(null)} />
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-3 pt-3">
                    {!voice.isDefault ? (
                      <Button onClick={() => setDefaultVoiceAction(voice.id)}>
                        Make workspace default
                      </Button>
                    ) : null}
                    <Button onClick={() => deleteVoiceAction(voice.id)}>Delete preset</Button>
                    <span className="font-sans text-[11px] text-muted-2">
                      Deleting unbinds every agent that used it. They fall back to the default.
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {voices.length > 0 ? <BindingTable voices={voices} agents={agents} /> : null}
    </div>
  )
}

function PresetForm({ voice, onDone }: { voice?: VoiceCard; onDone: () => void }) {
  const action = voice ? updateVoiceAction : createVoiceAction
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined)

  return (
    <form
      action={async (form) => {
        await formAction(form)
        onDone()
      }}
      className="rounded-[9px] border border-line bg-panel p-[14px_15px]"
    >
      {voice ? <input type="hidden" name="voiceId" value={voice.id} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Input label="Name" name="name" defaultValue={voice?.name} placeholder="Support calm" />
        <Select label="Locale" name="locale" options={LOCALES} defaultValue={voice?.locale ?? 'en-IN'} />
        <Select
          label="Family hint"
          name="familyHint"
          options={FAMILIES}
          defaultValue={voice?.familyHint ?? 'any'}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Rate" name="rate" type="number" step="0.01" defaultValue={voice?.rate ?? 1} />
          <Input label="Pitch" name="pitch" type="number" step="0.01" defaultValue={voice?.pitch ?? 1} />
        </div>
      </div>
      <div className="mt-3">
        <TextArea
          label="Note"
          name="note"
          rows={2}
          defaultValue={voice?.note}
          placeholder="Slow and low, for refund and billing flows"
        />
      </div>
      {state?.error ? (
        <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving' : voice ? 'Save preset' : 'Create preset'}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

/*
 * Preview speaks in the operator's own browser through the same SpeechSynthesis
 * API the widget uses, so what you hear is what a web caller hears on this
 * machine. It is not what a Mac caller hears: AVSpeechSynthesizer resolves its
 * own voice from the same locale and family hint.
 */
function PreviewButton({ voice }: { voice: VoiceCard }) {
  const [state, setState] = useState<'idle' | 'speaking' | 'unsupported'>('idle')

  const speak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setState('unsupported')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(
      voice.note || `This is the ${voice.name} preset. How can I help you today?`,
    )
    utterance.lang = voice.locale
    utterance.rate = voice.rate
    utterance.pitch = voice.pitch
    const match = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.replace('_', '-') === voice.locale)
    if (match) utterance.voice = match
    utterance.onend = () => setState('idle')
    utterance.onerror = () => setState('idle')
    setState('speaking')
    window.speechSynthesis.speak(utterance)
  }

  if (state === 'unsupported') {
    return <span className="font-sans text-[11px] text-muted-2">no speech on this browser</span>
  }
  return (
    <Button className="px-[9px] py-[6px] text-[11px]" onClick={speak}>
      {state === 'speaking' ? 'Playing' : 'Preview'}
    </Button>
  )
}

function BindingTable({ voices, agents }: { voices: VoiceCard[]; agents: VoiceAgent[] }) {
  const options = [
    { value: '', label: 'workspace default' },
    ...voices.map((voice) => ({ value: voice.id, label: voice.name })),
  ]

  return (
    <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
      <Eyebrow>AGENT BINDING</Eyebrow>
      <p className="mt-[6px] mb-3 font-sans text-[11.5px] text-muted">
        An agent with no preset speaks with the workspace default. The resolved preset goes out on
        the session response, so the widget and both SDKs apply it.
      </p>
      {agents.length === 0 ? (
        <p className="font-sans text-[12px] text-muted-2">No agents in this workspace yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between gap-3">
              <span className="font-sans text-[12.5px] font-medium text-ink-2">{agent.name}</span>
              <select
                defaultValue={agent.voiceId ?? ''}
                onChange={(event) => bindAgentVoiceAction(agent.id, event.target.value)}
                className="rounded-[6px] border border-line bg-panel px-[8px] py-[5px] font-sans text-[12px] text-ink outline-none focus:border-accent"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Locales the desktop and mobile voice sets commonly do not carry. */
function isRiskyLocale(locale: string): boolean {
  return !locale.startsWith('en-')
}

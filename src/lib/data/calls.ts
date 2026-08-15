import type { CallActivity } from '@/lib/activity'

export interface LiveCallLine {
  at: string
  text: string
  tone: 'prior' | 'current' | 'alert'
}

export interface LiveCallChip {
  label: string
  tone: 'neutral' | 'muted' | 'alert'
}

export interface LiveCall {
  id: string
  display: string
  agent: string
  locale: string
  elapsedSec: number
  v2vMs: number
  activity: CallActivity
  activityDetail: string
  lines: LiveCallLine[]
  chips: LiveCallChip[]
  footLeft: string
  footRight: string
  footTone: 'good' | 'alert' | 'muted'
  actions: [string, string, string]
  alert?: boolean
}

export interface EndedCall {
  id: string
  number: string
  agent: string
  duration: string
  v2v: string
  v2vOver?: boolean
  barge: string
  outcome: string
  outcomeTone: 'good' | 'muted'
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

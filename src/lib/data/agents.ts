export type Tone = 'ok' | 'over' | 'muted'

export interface Agent {
  id: string
  name: string
  locale: string
  localeTone: 'neutral' | 'risk'
  summary: string
  status: 'live' | 'draft'
  /** STT / LLM / TTS display chips, in pipeline order. */
  pipeline: [string, string, string]
  series: string
  carrier: string
  p95Ms: number | null
  calls7d: number | null
  costPerMin: number | null
}

export const LATENCY_BUDGET_MS = 800

export function p95Tone(p95: number | null): Tone {
  if (p95 === null) return 'muted'
  return p95 > LATENCY_BUDGET_MS ? 'over' : 'ok'
}

export interface StudioMetric {
  label: string
  value: string
  unit?: string
  delta?: string
  note?: string
}

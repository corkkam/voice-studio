export type { PipelineStage } from '@/lib/data/defaults'

export interface TestTurn {
  speaker: 'AGENT' | 'CALLER'
  at: string
  text: string
  tool?: string
}

export { DEFAULT_PIPELINE as PIPELINE, DEFAULT_PROMPT, TURN_TAKING } from '@/lib/data/defaults'

export const BUDGET = {
  p50: null as number | null,
  p95: null as number | null,
  target: 800,
  hint: 'Budgets are targets until the first live turns arrive',
}

export const TOOLS = [
  { name: 'transfer_to_human', note: 'SDK event' },
  { name: 'end_session', note: 'hangup' },
]

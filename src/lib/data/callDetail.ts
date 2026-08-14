export interface TranscriptTurn {
  at: string
  speaker: 'AGENT' | 'CALLER'
  text: string
  redacted?: { before: string; token: string; after: string }
  aside?: string
  notes?: string[]
  tools?: string[]
  selected?: boolean
  selectedNote?: string
}

export interface Span {
  name: string
  ms: number
  depth: number
  offsetPct: number
  widthPct: number
  color: string
}

export interface TurnLatency {
  turn: string
  stt: string
  llm: string
  tts: string
  v2v: string
  selected?: boolean
}

export type WaveBand = 'agent' | 'caller' | 'silence'

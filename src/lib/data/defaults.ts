export interface PipelineStage {
  key: string
  step: string
  model: string
  detail: string
  hosting: string
  hostingTone: 'good' | 'muted'
  latencyMs: number
  latencyQualifier?: string
  cost: string
  active?: boolean
  budgetColor: string
  budgetLabel: string
}

/** Design-time latency budget per stage — not measured traffic. */
export const DEFAULT_PIPELINE: PipelineStage[] = [
  {
    key: 'vad',
    step: '1 · VAD + TURN',
    model: 'Silero v5',
    detail: '+ Smart Turn v2 semantic',
    hosting: 'client SDK',
    hostingTone: 'good',
    latencyMs: 42,
    cost: 'local',
    budgetColor: '#1c1917',
    budgetLabel: 'VAD 42',
  },
  {
    key: 'stt',
    step: '2 · STT',
    model: 'Platform / device STT',
    detail: 'Web Speech · SFSpeechRecognizer',
    hosting: 'client SDK',
    hostingTone: 'good',
    latencyMs: 208,
    cost: 'local',
    budgetColor: '#e4572e',
    budgetLabel: 'STT 208',
  },
  {
    key: 'llm',
    step: '3 · LLM',
    model: 'grok-4.6',
    detail: 'Turn complete via /api/media/complete',
    hosting: 'control plane',
    hostingTone: 'muted',
    latencyMs: 168,
    latencyQualifier: 'ttft',
    cost: 'BYO / platform',
    active: true,
    budgetColor: 'oklch(0.62 0.15 55)',
    budgetLabel: 'LLM 168',
  },
  {
    key: 'tts',
    step: '4 · TTS',
    model: 'Platform / device TTS',
    detail: 'SpeechSynthesis · AVSpeechSynthesizer',
    hosting: 'client SDK',
    hostingTone: 'good',
    latencyMs: 74,
    latencyQualifier: 'ttfa',
    cost: 'local',
    budgetColor: 'oklch(0.6 0.13 172)',
    budgetLabel: 'TTS 74',
  },
  {
    key: 'transport',
    step: '5 · TRANSPORT',
    model: 'REST + SSE',
    detail: 'Web widget · JS SDK · macOS SDK',
    hosting: 'licensed later',
    hostingTone: 'muted',
    latencyMs: 31,
    cost: 'session',
    budgetColor: '#b8afa4',
    budgetLabel: 'playback 31',
  },
]

export const DEFAULT_PROMPT = `You are a concise voice assistant.
Open with a one-sentence greeting. Ask one question at a time.
Never invent account balances, phone numbers, or legal claims.
If you cannot help, say so and offer to connect a human.`

export const TURN_TAKING = [
  { label: 'Endpoint silence', value: '280 ms', tone: 'ink' as const },
  { label: 'Barge-in', value: 'cancel TTS + flush', tone: 'good' as const },
  { label: 'Backchannel filter', value: 'client SDK', tone: 'ink' as const },
  { label: 'Noise cancel before VAD', value: 'device', tone: 'good' as const },
]

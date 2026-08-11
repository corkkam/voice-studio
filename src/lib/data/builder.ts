export interface PipelineStage {
  key: string
  /** "1 · VAD + TURN" */
  step: string
  model: string
  detail: string
  hosting: string
  hostingTone: 'good' | 'muted'
  latencyMs: number
  /** "ttft" / "ttfa" — what the number actually measures. */
  latencyQualifier?: string
  cost: string
  /** The stage currently open in the router. */
  active?: boolean
  /** Share of the voice-to-voice budget, and its swatch. */
  budgetColor: string
  budgetLabel: string
}

export const PIPELINE: PipelineStage[] = [
  {
    key: 'vad',
    step: '1 · VAD + TURN',
    model: 'Silero v5',
    detail: '+ Smart Turn v2 semantic',
    hosting: 'self-host',
    hostingTone: 'good',
    latencyMs: 42,
    cost: '$0.000',
    budgetColor: '#1c1917',
    budgetLabel: 'VAD 42',
  },
  {
    key: 'stt',
    step: '2 · STT',
    model: 'Sarvam Saaras v3',
    detail: 'Hinglish · fallback Nova-3 Flux',
    hosting: 'API · BYO key',
    hostingTone: 'muted',
    latencyMs: 208,
    cost: '$0.008',
    budgetColor: '#e4572e',
    budgetLabel: 'STT 208',
  },
  {
    key: 'llm',
    step: '3 · LLM',
    model: 'GPT-4o-mini',
    detail: 'reasoning_effort: none',
    hosting: 'editing',
    hostingTone: 'muted',
    latencyMs: 168,
    latencyQualifier: 'ttft',
    cost: '$0.021',
    active: true,
    budgetColor: 'oklch(0.62 0.15 55)',
    budgetLabel: 'LLM 168',
  },
  {
    key: 'tts',
    step: '4 · TTS',
    model: 'Sarvam Bulbul v3',
    detail: 'voice: Meera · Indian normalizer',
    hosting: 'API · INR',
    hostingTone: 'muted',
    latencyMs: 74,
    latencyQualifier: 'ttfa',
    cost: '$0.030',
    budgetColor: 'oklch(0.6 0.13 172)',
    budgetLabel: 'TTS 74',
  },
  {
    key: 'transport',
    step: '5 · TRANSPORT',
    model: 'Exotel UL-VNO',
    detail: '1600 series · media in India',
    hosting: 'licensed',
    hostingTone: 'good',
    latencyMs: 31,
    cost: '₹0.60',
    budgetColor: '#b8afa4',
    budgetLabel: 'playback 31',
  },
]

export const BUDGET = {
  p50: 523,
  p95: 780,
  target: 800,
  hint: 'Swap STT → Deepgram Flux to save ~180 ms',
}

export const SYSTEM_PROMPT_TOKENS = '1,284 tok · cached'

export const TURN_TAKING = [
  { label: 'Endpoint silence', value: '280 ms', tone: 'ink' as const },
  { label: 'Barge-in', value: 'cancel TTS + flush', tone: 'good' as const },
  { label: 'Backchannel filter', value: 'Krisp VIVA 2.0', tone: 'ink' as const },
  { label: 'Noise cancel before VAD', value: 'on', tone: 'good' as const },
]

export const TOOLS = [
  { name: 'get_loan_status', note: '98.2% ok' },
  { name: 'log_ptp', note: '99.6% ok' },
  { name: 'send_payment_link', note: 'args whitelisted' },
  { name: 'transfer_to_agent', note: 'SIP REFER' },
]

export interface TestTurn {
  speaker: 'AGENT' | 'CALLER'
  at: string
  text: string
  tool?: string
}

export const TEST_TRANSCRIPT: TestTurn[] = [
  {
    speaker: 'AGENT',
    at: '0:02',
    text: 'Namaste, main Acme Finance se Meera bol rahi hoon. Yeh call record ho rahi hai aur main ek AI assistant hoon.',
  },
  { speaker: 'CALLER', at: '0:11', text: 'Haan boliye, kitna pending hai?' },
  {
    speaker: 'AGENT',
    at: '0:13',
    text: 'Aapki EMI ₹4,820 thi, due date 5 August. Aaj pay kar sakte hain?',
    tool: 'tool get_loan_status · 88 ms',
  },
  { speaker: 'CALLER', at: '0:19', text: 'Salary 12 ko aayegi, tab kar dunga.' },
]

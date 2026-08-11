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

export const AGENTS: Agent[] = [
  {
    id: 'loan-collections',
    name: 'Loan collections',
    locale: 'hi-IN + en',
    localeTone: 'neutral',
    summary: 'Hinglish code-switch · promise-to-pay capture',
    status: 'live',
    pipeline: ['Saaras v3', 'GPT-4o-mini', 'Bulbul v3'],
    series: '1600 · BFSI',
    carrier: 'Exotel UL-VNO',
    p95Ms: 780,
    calls7d: 12480,
    costPerMin: 0.11,
  },
  {
    id: 'support-triage',
    name: 'Support triage',
    locale: 'en',
    localeTone: 'neutral',
    summary: 'Warm transfer on SIP REFER · 6 tools',
    status: 'live',
    pipeline: ['Deepgram Flux', 'Claude Haiku', 'Sonic-3'],
    series: 'Inbound DID',
    carrier: 'Plivo · Twilio (US)',
    p95Ms: 690,
    calls7d: 8940,
    costPerMin: 0.14,
  },
  {
    id: 'field-verification',
    name: 'Field verification',
    locale: 'ta-IN',
    localeTone: 'neutral',
    summary: 'Fully self-hosted · vLLM pool, Mumbai',
    status: 'live',
    pipeline: ['Parakeet-TDT', 'Llama 3.3 70B', 'IndicTTS'],
    series: '1600 · BFSI',
    carrier: 'Ozonetel',
    p95Ms: 910,
    calls7d: 3210,
    costPerMin: 0.04,
  },
  {
    id: 'interview-sde-ii',
    name: 'Interview screen — SDE II',
    locale: 'high-risk',
    localeTone: 'risk',
    summary: 'Rubric scoring · proctoring · no EU emotion inference',
    status: 'live',
    pipeline: ['Nova-3', 'Claude Sonnet', 'ElevenLabs Turbo'],
    series: 'Web / WebRTC',
    carrier: 'LiveKit room',
    p95Ms: 820,
    calls7d: 614,
    costPerMin: 0.22,
  },
  {
    id: 'meeting-notetaker',
    name: 'Meeting notetaker',
    locale: 'draft',
    localeTone: 'neutral',
    summary: 'Recall.ai bot · Zoom, Meet, Teams · listen + speak',
    status: 'draft',
    pipeline: ['Universal-3', 'GPT-4o', 'Kokoro-82M'],
    series: '—',
    carrier: '$0.50/hr recording',
    p95Ms: null,
    calls7d: null,
    costPerMin: null,
  },
]

export const LATENCY_BUDGET_MS = 800

export function p95Tone(p95: number | null): Tone {
  if (p95 === null) return 'muted'
  return p95 > LATENCY_BUDGET_MS ? 'over' : 'ok'
}

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id)
}

export interface StudioMetric {
  label: string
  value: string
  unit?: string
  delta?: string
  note?: string
}

export const STUDIO_METRICS: StudioMetric[] = [
  {
    label: 'VOICE MINUTES · AUG',
    value: '214,900',
    delta: '+18%',
    note: 'hybrid tier · self-host crossover passed',
  },
  {
    label: 'VOICE-TO-VOICE P95',
    value: '762',
    unit: 'ms',
    note: 'budget 800 ms',
  },
  {
    label: 'BLENDED COST',
    value: '$0.083',
    unit: '/min',
    note: 'Kokoro TTS self-hosted on 2×H100',
  },
]

export const MEDIA_PLANE = {
  region: 'Mumbai (in-country)',
  health: 'healthy',
  gpuUtil: 62,
  sessions: 128,
  capacity: 240,
}

export const WORKSPACE = {
  tenant: 'Acme Finance NBFC',
  region: 'IN-SOUTH',
  date: 'Aug 11, 2026',
  initials: 'RK',
}

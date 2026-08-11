export interface TranscriptTurn {
  at: string
  speaker: 'AGENT' | 'CALLER'
  text: string
  /** Rendered as a redaction pill inside the line. */
  redacted?: { before: string; token: string; after: string }
  /** Bracketed pipeline aside, e.g. a barge-in note. */
  aside?: string
  /** Compliance affirmations — outlined pills. */
  notes?: string[]
  /** Tool invocations — filled pills. */
  tools?: string[]
  /** The turn the span waterfall on the right is showing. */
  selected?: boolean
  selectedNote?: string
}

export const CALL = {
  id: 'call_01K9ZQ4M',
  campaign: 'Collections — Aug W2',
  campaignId: 'collections-aug-w2',
  number: '+91 98•••• 4412',
  duration: '3:41',
  outcome: 'Promise to pay · 12 Sep · ₹4,820',
}

export const TRANSCRIPT: TranscriptTurn[] = [
  {
    at: '0:00',
    speaker: 'AGENT',
    text: 'Namaste, main Acme Finance se Meera bol rahi hoon. Yeh call record ho rahi hai aur main ek AI assistant hoon. Aage badhna theek hai?',
    notes: ['AI + recording disclosure ✓', 'DPDP §5 notice hi-IN'],
  },
  { at: '0:11', speaker: 'CALLER', text: 'Haan boliye, kitna pending hai?' },
  {
    at: '0:13',
    speaker: 'AGENT',
    text: 'Aapki EMI ₹4,820 thi, due date 5 August. Kya aaj payment kar sakte hain?',
    tools: ['get_loan_status · 88 ms · ok'],
  },
  {
    at: '0:19',
    speaker: 'CALLER',
    text: '',
    redacted: {
      before: 'Mera PAN ',
      token: '[PAN redacted]',
      after: ' hai, salary 12 ko aayegi — tab kar dunga.',
    },
  },
  {
    at: '0:24',
    speaker: 'AGENT',
    text: 'Theek hai, 12 September ko ₹4,820 — main yeh note kar rahi hoon. Aapko payment link SMS par bhej deti hoon.',
    tools: ['log_ptp(2026-09-12, 4820)', 'send_payment_link'],
    selected: true,
    selectedNote: 'turn 5 · selected',
  },
  {
    at: '0:34',
    speaker: 'CALLER',
    text: 'Haan bhej do.',
    aside: '[barge-in — TTS cancelled at 210 ms]',
  },
  {
    at: '0:41',
    speaker: 'AGENT',
    text: 'Link bhej diya hai registered number par. UPI ya net banking, dono chalega.',
    tools: ['send_payment_link · 132 ms · ok'],
  },
  {
    at: '1:03',
    speaker: 'CALLER',
    text: 'Ek minute — pichle mahine ka late fee bhi lag gaya hai kya?',
  },
  {
    at: '1:11',
    speaker: 'AGENT',
    text: 'Ji, ₹236 late fee lagi hai — total ₹5,056. Agar aap dispute karna chahte hain to main aapko humare officer se connect kar sakti hoon.',
    tools: ['get_loan_status · 74 ms · ok'],
  },
  { at: '1:34', speaker: 'CALLER', text: 'Nahi nahi, dispute nahi karna. 12 ko pura kar dunga.' },
  {
    at: '1:52',
    speaker: 'AGENT',
    text: 'Samajh gayi. Toh 12 September ko ₹5,056 — main yeh confirm kar rahi hoon. Aapko ek din pehle reminder aa jayega.',
    tools: ['log_ptp(2026-09-12, 5056) · updated'],
  },
  { at: '2:24', speaker: 'CALLER', text: 'Aur agar 12 ko na ho paaya to?' },
  {
    at: '2:31',
    speaker: 'AGENT',
    text: 'Us case mein aap is number par call kar sakte hain ya link se partial payment kar sakte hain. Main aage koi call schedule nahi kar rahi.',
  },
  {
    at: '3:06',
    speaker: 'AGENT',
    text: 'Recap: 12 September, ₹5,056, payment link SMS par. Kuch aur poochna hai?',
  },
  { at: '3:24', speaker: 'CALLER', text: 'Nahi, bas. Dhanyavaad.' },
  {
    at: '3:33',
    speaker: 'AGENT',
    text: 'Dhanyavaad. Yeh call aur iski recording Acme Finance ke paas 180 din tak rahegi — aap kabhi bhi delete request kar sakte hain.',
    notes: ['retention notice ✓', 'call ended 3:41 · agent hangup'],
  },
]

export interface Span {
  name: string
  ms: number
  /** Nesting depth in the waterfall. */
  depth: number
  /** Percent offset and width along the 712 ms parent. */
  offsetPct: number
  widthPct: number
  color: string
}

export const TURN_5_SPANS: Span[] = [
  { name: 'invoke_agent', ms: 712, depth: 0, offsetPct: 0, widthPct: 100, color: '#4a423a' },
  {
    name: 'vad.speech_end (silero_v5)',
    ms: 42,
    depth: 1,
    offsetPct: 0,
    widthPct: 6,
    color: '#f4f1ec',
  },
  {
    name: 'stt.transcribe (saaras_v3)',
    ms: 208,
    depth: 1,
    offsetPct: 6,
    widthPct: 29,
    color: '#e4572e',
  },
  {
    name: 'llm.chat ttft (gpt-4o-mini)',
    ms: 168,
    depth: 1,
    offsetPct: 35,
    widthPct: 24,
    color: 'oklch(0.62 0.15 55)',
  },
  {
    name: 'execute_tool log_ptp',
    ms: 96,
    depth: 2,
    offsetPct: 44,
    widthPct: 13,
    color: '#8a7f72',
  },
  {
    name: 'tts.synthesize ttfa (bulbul_v3)',
    ms: 74,
    depth: 1,
    offsetPct: 59,
    widthPct: 10,
    color: 'oklch(0.65 0.13 172)',
  },
  {
    name: 'playback.first_byte',
    ms: 31,
    depth: 1,
    offsetPct: 69,
    widthPct: 4,
    color: '#b8afa4',
  },
]

export const TRACE = { id: '4f1a…c9', v2vMs: 712 }

export const CALL_METRICS = [
  { label: 'V2V P50 / P95', value: '523 / 780' },
  { label: 'Barge-ins', value: '2' },
  { label: 'Tool success', value: '3 / 3' },
  { label: 'Cost', value: '$0.41' },
]

export const RETENTION = [
  { label: 'Recording (S3, ap-south-1)', value: '180 d' },
  { label: 'Transcript (ClickHouse)', value: '24 mo' },
  { label: 'Consent record', value: 'explicit · 7 d validity' },
  { label: 'Exported to', value: 'Langfuse · ClickHouse' },
]

export interface TurnLatency {
  turn: string
  stt: string
  llm: string
  tts: string
  v2v: string
  selected?: boolean
}

export const TURN_LATENCY: TurnLatency[] = [
  { turn: '1 · 0:00', stt: '—', llm: '142', tts: '88', v2v: '486' },
  { turn: '3 · 0:13', stt: '196', llm: '158', tts: '71', v2v: '662' },
  { turn: '5 · 0:24', stt: '208', llm: '168', tts: '74', v2v: '712', selected: true },
  { turn: '7 · 0:41', stt: '184', llm: '151', tts: '69', v2v: '604' },
  { turn: '9 · 1:11', stt: '212', llm: '176', tts: '78', v2v: '731' },
  { turn: '11 · 1:52', stt: '199', llm: '164', tts: '72', v2v: '688' },
  { turn: '13 · 3:06', stt: '188', llm: '155', tts: '70', v2v: '623' },
  { turn: '15 · 3:33', stt: '175', llm: '149', tts: '66', v2v: '598' },
]

/**
 * The recorded-audio scrubber along the top of call detail. This one stays a
 * waveform: it is the recording's own amplitude over 3:41, a seek surface, not
 * a live agent — the orbs replaced the agent-activity waveforms only.
 *
 * Generated deterministically so the server and client render identical
 * markup, and so the four speaker runs stay visually distinct.
 */
export type WaveBand = 'agent' | 'caller' | 'silence'

export function recordingWaveform(): { h: number; band: WaveBand }[] {
  const runs: { band: WaveBand; count: number }[] = [
    { band: 'agent', count: 26 },
    { band: 'caller', count: 26 },
    { band: 'silence', count: 26 },
    { band: 'agent', count: 26 },
    { band: 'caller', count: 26 },
    { band: 'silence', count: 26 },
    { band: 'agent', count: 26 },
    { band: 'caller', count: 26 },
    { band: 'silence', count: 26 },
    { band: 'agent', count: 26 },
    { band: 'caller', count: 26 },
    { band: 'silence', count: 14 },
  ]

  // Mulberry32 — small, deterministic, no dependency.
  let seed = 0x9e3779b9
  const rand = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const bars: { h: number; band: WaveBand }[] = []
  for (const run of runs) {
    for (let i = 0; i < run.count; i++) {
      const h =
        run.band === 'silence'
          ? 12 + Math.round(rand() * 14)
          : 22 + Math.round(rand() * 78)
      bars.push({ h, band: run.band })
    }
  }
  return bars
}

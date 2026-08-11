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
  /** Masked E.164, or the candidate id for WebRTC interview rooms. */
  display: string
  agent: string
  locale: string
  elapsedSec: number
  v2vMs: number
  activity: CallActivity
  /** Sub-label under the orb — what the stage is waiting on. */
  activityDetail: string
  lines: LiveCallLine[]
  chips: LiveCallChip[]
  footLeft: string
  footRight: string
  footTone: 'good' | 'alert' | 'muted'
  actions: [string, string, string]
  alert?: boolean
}

export const LIVE_CALLS: LiveCall[] = [
  {
    id: 'call_01K9ZQ4M',
    display: '+91 98•••• 4412',
    agent: 'Loan collections',
    locale: 'hi-IN',
    elapsedSec: 134,
    v2vMs: 640,
    activity: 'speaking',
    activityDetail: 'Bulbul v3 · ttfa 74 ms',
    lines: [
      { at: '1:58', text: 'Aapki EMI ₹4,820 thi — aaj payment kar sakte hain?', tone: 'prior' },
      { at: '2:11', text: 'Salary 12 ko aayegi, tab kar dunga.', tone: 'current' },
    ],
    chips: [
      { label: 'STT 208', tone: 'neutral' },
      { label: 'LLM 168', tone: 'neutral' },
      { label: 'TTS 74', tone: 'neutral' },
      { label: 'turn 5', tone: 'muted' },
    ],
    footLeft: 'attempt 1/2 · 31–60 DPD',
    footRight: 'sentiment ↑',
    footTone: 'good',
    actions: ['Listen', 'Whisper', 'Take over'],
  },
  {
    id: 'call_01K9ZQ71',
    display: '+91 91•••• 0087',
    agent: 'Loan collections',
    locale: 'hi-IN',
    elapsedSec: 62,
    v2vMs: 1180,
    activity: 'recovering',
    activityDetail: 'Bulbul → Kokoro mid-turn',
    lines: [
      { at: '0:47', text: 'Yeh amount galat hai, maine pay kar diya…', tone: 'prior' },
      {
        at: '0:59',
        text: 'TTS underrun — Bulbul degraded, failing over to Kokoro mid-turn.',
        tone: 'alert',
      },
    ],
    chips: [
      { label: 'STT 214', tone: 'neutral' },
      { label: 'LLM 176', tone: 'neutral' },
      { label: 'TTS 720', tone: 'alert' },
      { label: '3 barge-ins', tone: 'muted' },
    ],
    footLeft: 'attempt 2/2 · 0–30 DPD',
    footRight: 'sentiment ↓',
    footTone: 'alert',
    actions: ['Listen', 'Whisper', 'Take over'],
    alert: true,
  },
  {
    id: 'call_01K9ZQ88',
    display: '+91 76•••• 2231',
    agent: 'Field verification',
    locale: 'ta-IN',
    elapsedSec: 38,
    v2vMs: 712,
    activity: 'listening',
    activityDetail: 'Parakeet-TDT · endpointing',
    lines: [
      { at: '0:22', text: 'வணக்கம், Acme Finance-ல் இருந்து பேசுகிறேன்.', tone: 'prior' },
      { at: '0:31', text: 'Address confirm — 4/221, Anna Nagar.', tone: 'current' },
    ],
    chips: [
      { label: 'STT 186', tone: 'neutral' },
      { label: 'LLM 244', tone: 'neutral' },
      { label: 'TTS 118', tone: 'neutral' },
      { label: 'self-hosted', tone: 'muted' },
    ],
    footLeft: 'Parakeet + IndicTTS · Mumbai pool',
    footRight: 'sentiment →',
    footTone: 'good',
    actions: ['Listen', 'Whisper', 'Take over'],
  },
  {
    id: 'call_01K9ZQ93',
    display: '+1 (415) 55•• 019',
    agent: 'Support triage',
    locale: 'en · inbound',
    elapsedSec: 291,
    v2vMs: 588,
    activity: 'transferring',
    activityDetail: 'SIP REFER → Tier 2',
    lines: [
      { at: '4:12', text: 'I need someone who can actually refund this.', tone: 'prior' },
      { at: '4:38', text: 'Connecting you to Tier 2 now — staying on the line.', tone: 'current' },
    ],
    chips: [
      { label: 'STT 96', tone: 'neutral' },
      { label: 'LLM 152', tone: 'neutral' },
      { label: 'TTS 58', tone: 'neutral' },
      { label: 'SIP REFER queued', tone: 'muted' },
    ],
    footLeft: 'inbound DID · 6 tools',
    footRight: 'sentiment ↓',
    footTone: 'alert',
    actions: ['Listen', 'Whisper', 'Take over'],
  },
  {
    id: 'call_01K9ZQA6',
    display: 'Interview · cand-8841',
    agent: 'SDE II screen',
    locale: 'WebRTC',
    elapsedSec: 1087,
    v2vMs: 804,
    activity: 'thinking',
    activityDetail: 'Claude Sonnet · rubric probe',
    lines: [
      { at: '17:20', text: "Walk me through how you'd shard that write path.", tone: 'prior' },
      { at: '17:44', text: "I'd hash on tenant_id, then… sorry, can you repeat?", tone: 'current' },
    ],
    chips: [
      { label: 'rubric Q4/9', tone: 'neutral' },
      { label: 'score 6.4', tone: 'neutral' },
      { label: '2 tab-switches', tone: 'alert' },
    ],
    footLeft: 'no emotion inference · IL consent ✓',
    footRight: 'gaze ok',
    footTone: 'good',
    actions: ['Listen', 'Flags', 'Join'],
  },
]

/** Fleet-wide dialer ratios, shown in the ops nav under the concurrency pool. */
export const DIALER_STATS = [
  { label: 'Answered', value: '68%' },
  { label: 'Machine detected (AMD)', value: '6.6%' },
  { label: 'DND-skipped', value: '2,617' },
]

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

export const ENDED_CALLS: EndedCall[] = [
  {
    id: 'call_01K9ZP12',
    number: '+91 63•••• 3308',
    agent: 'Loan collections',
    duration: '3:02',
    v2v: '754 ms',
    barge: '1',
    outcome: 'Paid on call',
    outcomeTone: 'good',
  },
  {
    id: 'call_01K9ZP20',
    number: '+91 88•••• 1276',
    agent: 'Loan collections',
    duration: '0:19',
    v2v: '688 ms',
    barge: '0',
    outcome: 'Voicemail (AMD)',
    outcomeTone: 'muted',
  },
  {
    id: 'call_01K9ZP31',
    number: '+1 (415) 55•• 771',
    agent: 'Support triage',
    duration: '5:41',
    v2v: '1,020 ms',
    v2vOver: true,
    barge: '4',
    outcome: 'Resolved · no transfer',
    outcomeTone: 'muted',
  },
  {
    id: 'call_01K9ZP44',
    number: '+91 70•••• 5590',
    agent: 'Loan collections',
    duration: '0:00',
    v2v: '—',
    barge: '—',
    outcome: 'DND · not dialed',
    outcomeTone: 'muted',
  },
  {
    id: 'call_01K9ZP52',
    number: '+91 99•••• 6104',
    agent: 'Field verification',
    duration: '1:47',
    v2v: '702 ms',
    barge: '0',
    outcome: 'Address confirmed',
    outcomeTone: 'muted',
  },
  {
    id: 'call_01K9ZP66',
    number: 'Interview · cand-8830',
    agent: 'SDE II screen',
    duration: '26:12',
    v2v: '818 ms',
    barge: '2',
    outcome: 'Scored 7.8 · advance',
    outcomeTone: 'muted',
  },
]

export const OPS_HEALTH = [
  { label: 'Exotel trunk', value: 'up', tone: 'good' as const },
  { label: 'Saaras v3', value: '142 ms', tone: 'good' as const },
  { label: 'Bulbul v3', value: 'degraded', tone: 'alert' as const },
  { label: 'Kokoro (failover)', value: 'active', tone: 'good' as const },
]

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

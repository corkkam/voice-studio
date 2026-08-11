export const CAMPAIGN = {
  id: 'collections-aug-w2',
  name: 'Collections — Aug W2',
  status: 'RUNNING',
  agent: 'Loan collections v13',
  subtitle: 'Agent: Loan collections v13 · 1600-series service calls · 9:00–18:00 IST',
  liveNow: 40,
  dialed: '18,204',
  total: '24,300',
  updated: 'updated 12s ago',
  knobs: ['Pacing 3.0×', 'Retry 2 · +48 h', 'Max 40 concurrent'],
}

export const FUNNEL = [
  { label: 'Connected', value: '11,890 · 65%', pct: 65, color: '#1c1917' },
  { label: 'Reached intent (EMI discussed)', value: '8,441 · 46%', pct: 46, color: '#e4572e' },
  {
    label: 'Promise to pay logged',
    value: '3,127 · 17%',
    pct: 17,
    color: 'oklch(0.6 0.13 172)',
  },
  { label: 'Transferred to human', value: '918 · 5%', pct: 5, color: '#b8afa4' },
]

export const FUNNEL_STATS = [
  { label: 'DND SKIPPED', value: '2,617' },
  { label: 'AMD / VOICEMAIL', value: '1,204' },
  { label: 'AVG HANDLE', value: '2:48' },
  { label: 'SPEND', value: '₹2.71L' },
]

export interface CampaignRow {
  callId?: string
  number: string
  bucket: string
  attempt: string
  v2v: string
  v2vOver?: boolean
  outcome: string
  outcomeTone: 'good' | 'muted'
}

export const CAMPAIGN_ROWS: CampaignRow[] = [
  {
    callId: 'call_01K9ZQ4M',
    number: '+91 98•••• 4412',
    bucket: '31–60 DPD',
    attempt: '1 of 2',
    v2v: '712 ms',
    outcome: 'PTP 12 Sep',
    outcomeTone: 'good',
  },
  {
    number: '+91 91•••• 0087',
    bucket: '0–30 DPD',
    attempt: '2 of 2',
    v2v: '1,180 ms',
    v2vOver: true,
    outcome: 'Disputed → human',
    outcomeTone: 'muted',
  },
  {
    number: '+91 70•••• 5590',
    bucket: '61–90 DPD',
    attempt: '1 of 2',
    v2v: '—',
    outcome: 'DND · skipped',
    outcomeTone: 'muted',
  },
  {
    number: '+91 88•••• 1276',
    bucket: '31–60 DPD',
    attempt: '1 of 2',
    v2v: '688 ms',
    outcome: 'Voicemail (AMD)',
    outcomeTone: 'muted',
  },
  {
    number: '+91 63•••• 3308',
    bucket: '90+ DPD',
    attempt: '1 of 2',
    v2v: '754 ms',
    outcome: 'Paid on call',
    outcomeTone: 'good',
  },
  {
    number: '+91 99•••• 6104',
    bucket: '31–60 DPD',
    attempt: '1 of 2',
    v2v: '702 ms',
    outcome: 'PTP 15 Sep',
    outcomeTone: 'good',
  },
  {
    number: '+91 80•••• 7742',
    bucket: '0–30 DPD',
    attempt: '1 of 2',
    v2v: '669 ms',
    outcome: 'No answer · retry 48 h',
    outcomeTone: 'muted',
  },
  {
    number: '+91 74•••• 1189',
    bucket: '61–90 DPD',
    attempt: '2 of 2',
    v2v: '731 ms',
    outcome: 'Wrong number · suppressed',
    outcomeTone: 'muted',
  },
  {
    number: '+91 96•••• 2050',
    bucket: '31–60 DPD',
    attempt: '1 of 2',
    v2v: '745 ms',
    outcome: 'Language switch → ta-IN',
    outcomeTone: 'muted',
  },
  {
    number: '+91 82•••• 9931',
    bucket: '90+ DPD',
    attempt: '2 of 2',
    v2v: '1,043 ms',
    v2vOver: true,
    outcome: 'Disputed → human',
    outcomeTone: 'muted',
  },
  {
    number: '+91 77•••• 4416',
    bucket: '0–30 DPD',
    attempt: '1 of 2',
    v2v: '698 ms',
    outcome: 'PTP 20 Sep',
    outcomeTone: 'good',
  },
]

/**
 * The dialed list, synthesised on demand.
 *
 * A live collections campaign is tens of thousands of rows; the hand-written
 * ones above lead, and the rest are generated per index so the table can be
 * windowed exactly like the live monitor. Nothing past the viewport is built.
 */
export const TOTAL_ROWS = 18204

const BUCKETS = ['0–30 DPD', '31–60 DPD', '61–90 DPD', '90+ DPD']
const OUTCOMES: { label: string; tone: 'good' | 'muted' }[] = [
  { label: 'PTP 12 Sep', tone: 'good' },
  { label: 'Paid on call', tone: 'good' },
  { label: 'PTP 20 Sep', tone: 'good' },
  { label: 'No answer · retry 48 h', tone: 'muted' },
  { label: 'Voicemail (AMD)', tone: 'muted' },
  { label: 'Disputed → human', tone: 'muted' },
  { label: 'DND · skipped', tone: 'muted' },
  { label: 'Wrong number · suppressed', tone: 'muted' },
]
const PREFIXES = ['98', '91', '76', '70', '88', '63', '99', '80', '74', '96', '82', '77']

function rand(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function campaignRowAt(index: number): CampaignRow {
  if (index < CAMPAIGN_ROWS.length) return CAMPAIGN_ROWS[index]

  const r = rand(index * 2246822519)
  const outcome = OUTCOMES[Math.floor(r() * OUTCOMES.length)]
  const skipped = outcome.label.startsWith('DND')
  const v2v = 640 + Math.floor(r() * 480)

  return {
    number: `+91 ${PREFIXES[Math.floor(r() * PREFIXES.length)]}•••• ${String(
      Math.floor(r() * 9000) + 1000,
    )}`,
    bucket: BUCKETS[Math.floor(r() * BUCKETS.length)],
    attempt: r() > 0.72 ? '2 of 2' : '1 of 2',
    v2v: skipped ? '—' : `${v2v.toLocaleString('en-US')} ms`,
    v2vOver: !skipped && v2v > 1000,
    outcome: outcome.label,
    outcomeTone: outcome.tone,
  }
}

export function sliceCampaignRows(offset: number, limit: number): CampaignRow[] {
  const out: CampaignRow[] = []
  for (let i = offset; i < Math.min(offset + limit, TOTAL_ROWS); i++) out.push(campaignRowAt(i))
  return out
}

export interface GateCheck {
  title: string
  detail: string
  state: 'pass' | 'warn' | 'off'
  action?: string
}

export const GATE_CHECKS: GateCheck[] = [
  {
    title: 'DLT Principal Entity',
    detail: 'PE ID 11029388•• · blockchain verified',
    state: 'pass',
  },
  { title: 'RTM binding active', detail: 'Exotel (TM) ↔ PE · valid to 2029', state: 'pass' },
  {
    title: 'Series 1600 · BFSI service',
    detail: '1600 4012 88 · not 140 (non-promotional)',
    state: 'pass',
  },
  {
    title: 'Template approved',
    detail: 'SCR-1170•• · script diff vs approved: 0',
    state: 'pass',
  },
  {
    title: 'NCPR / DND scrub',
    detail: '2,617 removed · registry pulled 1h 12m ago',
    state: 'pass',
  },
  {
    title: 'Consent expiring',
    detail: '412 records hit the 7-day explicit-consent cap in 36 h',
    state: 'warn',
    action: 'Re-collect consent →',
  },
  {
    title: 'DPDP §5 notice + AI disclosure',
    detail: 'en, hi, ta · played in first 5 s of every call',
    state: 'pass',
  },
]

export const GATE_TRAILING: GateCheck = {
  title: '140-series routing disabled',
  detail: 'Promotional path off for this campaign · service calls only',
  state: 'off',
}

export const DISCLOSURE_CLIP = {
  title: 'Disclosure audio · hi-IN',
  action: 'play 0:04',
  quote: '“Yeh call record ho rahi hai aur main ek AI assistant hoon.”',
  /** Played-portion / remaining split for the mini scrubber. */
  bars: [40, 72, 54, 88, 36, 64, 92, 48, 70, 30, 58, 82, 44, 26],
  played: 7,
}

export const SPAM_RISK = {
  label: 'Short calls per number / day',
  value: '312',
  pct: 39,
  thresholdPct: 80,
  note: 'TRAI AI/ML flag threshold ≈ 800/day. Rotating across 6 numbers.',
}

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

export interface GateCheck {
  title: string
  detail: string
  state: 'pass' | 'warn' | 'off'
  action?: string
}

export const EMPTY_GATE: GateCheck[] = [
  {
    title: 'DLT Principal Entity',
    detail: 'Not registered for this workspace',
    state: 'off',
    action: 'Add PE ID →',
  },
  { title: 'RTM binding', detail: 'No telemarketer binding on file', state: 'off' },
  { title: 'Number series', detail: 'No 1600-series DID attached', state: 'off' },
  { title: 'Template approved', detail: 'No script submitted', state: 'off' },
  { title: 'NCPR / DND scrub', detail: 'No list loaded', state: 'off' },
  { title: 'Consent records', detail: 'No consent ledger yet', state: 'off' },
  { title: 'DPDP §5 notice + AI disclosure', detail: 'Add to the system prompt before publish', state: 'off' },
]

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
    action: 'Add PE ID',
  },
  { title: 'RTM binding', detail: 'No telemarketer binding on file', state: 'off' },
  { title: 'Number series', detail: 'No 1600-series DID attached', state: 'off' },
  { title: 'Template approved', detail: 'No script submitted', state: 'off' },
  { title: 'NCPR / DND scrub', detail: 'No list loaded', state: 'off' },
  { title: 'Consent records', detail: 'No consent ledger yet', state: 'off' },
  { title: 'AI disclosure', detail: 'No disclosure set on the agent', state: 'off', action: 'Set it on Compliance' },
]

export interface GateInput {
  agentName: string | null
  disclosure: string
  retentionDays: number
  numberIntents: number
}

/*
 * The gate used to be a hardcoded list of "off", which meant nothing. Four of the
 * seven checks now read real rows, and the three that cannot be checked from
 * inside this product stay off and say why. A check must never read as passed
 * because a form was filled in: the disclosure check passes only because the row
 * exists and the session response carries it.
 */
export function campaignGate(input: GateInput): GateCheck[] {
  return [
    {
      title: 'DLT Principal Entity',
      detail: 'Registration happens with the carrier, not here',
      state: 'off',
    },
    {
      title: 'RTM binding',
      detail: 'No telemarketer binding on file',
      state: 'off',
    },
    {
      title: 'Number series',
      detail:
        input.numberIntents === 0
          ? 'No number recorded. Nothing is provisioned either way'
          : `${input.numberIntents} intent(s) recorded, none provisioned`,
      state: 'off',
      action: 'Numbers and SIP',
    },
    {
      title: 'Agent assigned',
      detail: input.agentName ? input.agentName : 'No agent on this campaign',
      state: input.agentName ? 'pass' : 'off',
    },
    {
      title: 'AI disclosure',
      detail: input.disclosure
        ? 'Set on the agent and returned to every client'
        : 'No disclosure set on the agent',
      state: input.disclosure ? 'pass' : 'off',
      action: input.disclosure ? undefined : 'Set it on Compliance',
    },
    {
      title: 'Retention window',
      detail: `${input.retentionDays} days, recorded. No job deletes anything yet`,
      state: 'warn',
      action: 'Compliance',
    },
    {
      title: 'Consent records',
      detail: 'No consent ledger exists in this product',
      state: 'off',
    },
  ]
}

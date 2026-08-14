import { TopBar } from '@/components/shell/TopBar'
import { ComplianceManager } from '@/components/compliance/ComplianceManager'
import { requireAuth } from '@/lib/auth/session'
import { listAgentSummaries } from '@/lib/store/agents'
import { countCallsByAgent } from '@/lib/store/metrics'
import { listPolicies, retentionState, DEFAULT_RETENTION_DAYS } from '@/lib/store/policies'

/*
 * The split below is the whole point of this screen. A compliance surface that
 * implies enforcement it does not have is worse than no surface, so a control
 * that no code path enforces is listed as recorded intent and says so.
 */
const ENFORCED = [
  { title: 'Tenant isolation', detail: 'Every query is scoped by tenant_id' },
  { title: 'Key secrets not stored', detail: 'sha256 only, shown once at creation' },
  { title: 'Sign-in on every surface', detail: 'proxy.ts, with no bypass flag' },
  { title: 'Outbound dialer locked', detail: 'There is no dialer to start' },
]

const INTENT_ONLY = [
  { title: 'Retention window', detail: 'Stored per agent. No job deletes anything' },
  { title: 'Disclosure line', detail: 'Sent to the client. The client must play it' },
  { title: 'PII redaction', detail: 'Would apply to new turns only, never to history' },
]

export default async function CompliancePage() {
  const auth = await requireAuth()
  const agents = listAgentSummaries(auth.tenant.id)
  const policies = listPolicies(auth.tenant.id)
  const byAgent = new Map(policies.map((policy) => [policy.agent_id, policy]))
  const calls = countCallsByAgent(auth.tenant.id)
  const retention = retentionState(auth.tenant.id)
  const gaps = agents.filter(
    (agent) => agent.status === 'live' && !byAgent.get(agent.id)?.disclosure,
  ).length

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Compliance
        </h1>
        <p className="mt-[6px] mb-6 max-w-[680px] font-sans text-[13px] text-muted">
          Policy per agent, and what the runtime actually enforces. {agents.length} agent
          {agents.length === 1 ? '' : 's'},{' '}
          {gaps === 0 ? 'no gaps' : `${gaps} gap${gaps === 1 ? '' : 's'}`}. The campaign gate reads
          these rows, so a change here changes what a campaign is allowed to do.
        </p>
        <ComplianceManager
          policies={agents.map((agent) => {
            const policy = byAgent.get(agent.id)
            return {
              agentId: agent.id,
              agentName: agent.name,
              status: agent.status,
              calls: calls[agent.id] ?? 0,
              disclosure: policy?.disclosure ?? '',
              retentionDays: policy?.retention_days ?? DEFAULT_RETENTION_DAYS,
              redactPii: policy?.redact_pii === 1,
            }
          })}
          held={retention.held}
          expired={retention.expired}
          enforced={ENFORCED}
          intentOnly={INTENT_ONLY}
        />
      </div>
    </>
  )
}

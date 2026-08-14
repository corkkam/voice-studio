import { TopBar } from '@/components/shell/TopBar'
import { KnowledgeManager } from '@/components/knowledge/KnowledgeManager'
import { requireAuth } from '@/lib/auth/session'
import { getAgentRow, listAgentSummaries } from '@/lib/store/agents'
import {
  PROMPT_CEILING,
  countToolIntents,
  listSnippets,
  listTools,
  resolveSystemPrompt,
} from '@/lib/store/knowledge'

export default async function KnowledgePage() {
  const auth = await requireAuth()
  const snippets = listSnippets(auth.tenant.id)
  const tools = listTools(auth.tenant.id)
  const agents = listAgentSummaries(auth.tenant.id).map((agent) => ({
    id: agent.id,
    name: agent.name,
  }))

  // The preview is for the first agent, because a resolved prompt is per agent
  // and one worked example says more than a count of snippets does.
  const first = agents[0] ? getAgentRow(auth.tenant.id, agents[0].id) : undefined
  const resolved = first
    ? resolveSystemPrompt(auth.tenant.id, first.id, first.system_prompt)
    : undefined

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Knowledge and tools
        </h1>
        <p className="mt-[6px] mb-6 max-w-[680px] font-sans text-[13px] text-muted">
          What the agent is told before the caller speaks, and what it is allowed to ask for.
          Snippets go into the system prompt. Tools are declared to the model, recorded on the turn,
          and executed by your client.
        </p>
        <KnowledgeManager
          snippets={snippets.map((snippet) => ({
            id: snippet.id,
            name: snippet.name,
            body: snippet.body,
            scopeAll: snippet.scope_all === 1,
            agentIds: snippet.agentIds,
            chars: snippet.body.length,
          }))}
          tools={tools.map((tool) => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            params: tool.params_json,
          }))}
          agents={agents}
          ceiling={PROMPT_CEILING}
          toolIntents7d={countToolIntents(auth.tenant.id)}
          preview={
            first && resolved
              ? {
                  agentName: first.name,
                  snippetNames: resolved.snippetNames,
                  toolNames: resolved.toolNames,
                  chars: resolved.chars,
                  dropped: resolved.dropped,
                  system: resolved.system,
                }
              : null
          }
        />
      </div>
    </>
  )
}

import 'server-only'

import { appendTurn, listTurns, setCallActivity } from '@/lib/store/calls'
import { getAgentById } from '@/lib/store/agents'
import { resolveSystemPrompt } from '@/lib/store/knowledge'
import { resolveModelRoute, ModelRouteError, type ModelRoute, type ModelSource } from '@/lib/models/route'
import type { ModelRef } from '@/lib/models/catalog'
import type { AgentRow, CallRow } from '@/lib/store/types'

export interface CompleteResult {
  text: string
  llmMs: number
  model: string
  provider: string
  /** Where the choice came from: request, session, agent or platform. */
  source: ModelSource | 'none'
  fallback: boolean
  /** The tool the model asked for, if any. The client executes it, not us. */
  tool?: string
}

const BASE_PROMPT = 'You are a concise voice assistant.'

export async function completeTurn(
  call: CallRow,
  userText: string,
  override?: ModelRef,
): Promise<CompleteResult> {
  const started = Date.now()
  setCallActivity(call, 'thinking', 'generating reply')
  appendTurn(call, { speaker: 'CALLER', text: userText, activity: 'thinking', activityDetail: 'generating reply' })

  const agent = getAgentById(call.agent_id)
  const history = listTurns(call.id)
  const messages = history.map((turn) => ({
    role: turn.speaker === 'AGENT' ? 'assistant' : 'user',
    content: turn.text,
  }))
  // Grounding text and tool declarations are composed in one place so the
  // /knowledge screen and the runtime can never disagree.
  const resolved = resolveSystemPrompt(
    call.tenant_id,
    call.agent_id,
    agent?.system_prompt || BASE_PROMPT,
  )

  let route: ModelRoute | undefined
  if (agent) {
    const chosen = Boolean(override || (call.model_provider && call.model_name) || agent.model_provider)
    try {
      route = resolveModelRoute({ tenantId: call.tenant_id, agent, call, override })
    } catch (error) {
      // A tenant that picked a model must see why it did not run. A tenant that
      // picked nothing gets the fallback line instead of a failed call.
      if (chosen || !(error instanceof ModelRouteError)) throw error
    }
  }

  const result = route
    ? await generateReply(route, resolved.system, messages)
    : fallbackReply(messages)


  const llmMs = Date.now() - started
  const tool = detectTool(result.text, resolved.toolNames)
  appendTurn(call, {
    speaker: 'AGENT',
    text: result.text,
    tool,
    v2vMs: llmMs,
    llmMs,
    model: result.fallback ? undefined : result.label,
    activity: 'speaking',
    activityDetail: result.fallback ? 'fallback reply' : `${result.label} ${llmMs} ms`,
  })
  return {
    text: result.text,
    llmMs,
    model: result.model,
    provider: result.provider,
    source: result.source,
    fallback: result.fallback,
    tool,
  }
}

/*
 * A recorded intent, not an execution. The control plane never calls a tenant's
 * endpoint during a turn: that would be a request-forgery surface and would need
 * a secret store we do not have. The name lands on call_turns.tool and goes back
 * to the client, which holds its own credentials and does the work.
 */
function detectTool(reply: string, toolNames: string[]): string | undefined {
  if (toolNames.length === 0) return undefined
  const haystack = reply.toLowerCase()
  return toolNames.find((name) => haystack.includes(name.toLowerCase()))
}

/*
 * The eval path. It takes the same route resolution and the same fetch a real
 * turn takes, so the latency an eval reports is the latency a caller would get.
 * It creates no call row: an eval is not traffic and must not reach the monitor.
 */
export async function replyForEval(input: {
  tenantId: string
  agent: AgentRow
  system: string
  utterance: string
}): Promise<{ text: string; fallback: boolean }> {
  const messages = [{ role: 'user', content: input.utterance }]
  let route: ModelRoute | undefined
  try {
    route = resolveModelRoute({ tenantId: input.tenantId, agent: input.agent })
  } catch (error) {
    if (!(error instanceof ModelRouteError)) throw error
  }
  const result = route
    ? await generateReply(route, input.system, messages)
    : fallbackReply(messages)
  return { text: result.text, fallback: result.fallback }
}

interface ReplyResult {
  text: string
  model: string
  provider: string
  label: string
  source: ModelSource | 'none'
  fallback: boolean
}

/**
 * One fetch for every provider. They all speak the OpenAI chat-completions shape,
 * which is the reason the catalogue is restricted to providers that do.
 */
async function generateReply(
  route: ModelRoute,
  system: string,
  messages: { role: string; content: string }[],
): Promise<ReplyResult> {
  const res = await fetch(`${route.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: route.model,
      messages: [{ role: 'system', content: system }, ...messages],
      stream: false,
    }),
  })
  if (!res.ok) {
    // A provider error body can carry vendor detail and echo the request, so it
    // stays in the server log and the caller gets the status only.
    console.error('model request failed', route.provider, res.status, (await res.text()).slice(0, 400))
    throw new Error(`Model request failed (${res.status}).`)
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = body.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('The model returned an empty reply.')
  return {
    text,
    model: route.model,
    provider: route.provider,
    label: route.label,
    source: route.source,
    fallback: false,
  }
}

function fallbackReply(messages: { role: string; content: string }[]): ReplyResult {
  const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
  return {
    text: `I heard you. ${last ? `You said: "${last.slice(0, 180)}". ` : ''}Connect a model key in the studio to get a live reply.`,
    model: 'fallback',
    provider: 'none',
    label: 'fallback',
    source: 'none',
    fallback: true,
  }
}

import 'server-only'

import { appendTurn, listTurns, setCallActivity, setCallPending } from '@/lib/store/calls'
import { getAgentById } from '@/lib/store/agents'
import { resolveSystemPrompt } from '@/lib/store/knowledge'
import { getConnector, useConnectorToken } from '@/lib/store/connectors'
import { callRemoteTool, McpError } from '@/lib/connectors/mcp'
import { resolveModelRoute, ModelRouteError, type ModelRoute, type ModelSource } from '@/lib/models/route'
import type { ModelRef } from '@/lib/models/catalog'
import type { AgentRow, CallRow, ToolRow } from '@/lib/store/types'

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  id: string
  result: string
}

export interface CompleteResult {
  text: string
  llmMs: number
  model: string
  provider: string
  /** Where the choice came from: request, session, agent or platform. */
  source: ModelSource | 'none'
  fallback: boolean
  /** The first tool named this turn, for the audit trail. */
  tool?: string
  /**
   * Tools the caller's own app has to run. Empty when the turn is finished. A
   * connector tool never appears here; we run those ourselves.
   */
  toolCalls: ToolCall[]
}

const BASE_PROMPT = 'You are a concise voice assistant.'

/*
 * A turn may bounce between the model and a connector a few times. Three is enough
 * for look up then answer, and low enough that a caller is never left listening to
 * silence while a loop unwinds.
 */
const MAX_TOOL_STEPS = 3

interface ChatMessage {
  role: string
  content: string | null
  tool_calls?: RawToolCall[]
  tool_call_id?: string
}

interface RawToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

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
  const messages: ChatMessage[] = history.map((turn) => ({
    role: turn.speaker === 'AGENT' ? 'assistant' : 'user',
    content: turn.text,
  }))
  // Grounding text and the tool list are composed in one place so the /knowledge
  // screen and the runtime can never disagree about what an agent can reach.
  const resolved = resolveSystemPrompt(
    call.tenant_id,
    call.agent_id,
    agent?.system_prompt || BASE_PROMPT,
  )

  const route = routeFor(call, agent, override)
  if (!route) return finish(call, fallbackReply(messages), [], started)

  const outcome = await runToolLoop(call, route, resolved.system, messages, resolved.tools, 0)
  return finish(call, outcome.reply, outcome.pending, started)
}

/**
 * The second half of a turn whose tools the caller ran. The conversation resumes
 * from what the call was holding, so the model sees its own tool call and the
 * result side by side, which is what the chat-completions shape requires.
 */
export async function continueTurn(call: CallRow, results: ToolResult[]): Promise<CompleteResult> {
  const started = Date.now()
  const pending = readPending(call)
  if (!pending) throw new Error('This session is not waiting on a tool result.')

  const agent = getAgentById(call.agent_id)
  const resolved = resolveSystemPrompt(
    call.tenant_id,
    call.agent_id,
    agent?.system_prompt || BASE_PROMPT,
  )
  const route = routeFor(call, agent, undefined)
  if (!route) {
    setCallPending(call, null)
    return finish(call, fallbackReply(pending.messages), [], started)
  }

  const answered = new Map(results.map((entry) => [entry.id, entry.result]))
  const messages: ChatMessage[] = [
    ...pending.messages,
    ...pending.calls.map((wanted) => ({
      role: 'tool',
      content: answered.get(wanted.id) ?? 'The client returned no result for this tool.',
      tool_call_id: wanted.id,
    })),
  ]

  const outcome = await runToolLoop(call, route, resolved.system, messages, resolved.tools, pending.step + 1)
  return finish(call, outcome.reply, outcome.pending, started)
}

interface LoopOutcome {
  reply: ReplyResult
  pending: ToolCall[]
}

/*
 * One loop, two kinds of tool. A connector tool is executed here against its MCP
 * server and the result goes straight back to the model. A client tool cannot be:
 * only the caller's app holds the data or the credentials for it, so the loop stops
 * and hands the call out, and `continueTurn` picks the same loop back up.
 */
async function runToolLoop(
  call: CallRow,
  route: ModelRoute,
  system: string,
  messages: ChatMessage[],
  tools: ToolRow[],
  startStep: number,
): Promise<LoopOutcome> {
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  const specs = tools.map(toolSpec)
  const convo = [...messages]

  for (let step = startStep; step < MAX_TOOL_STEPS; step += 1) {
    const reply = await callModel(route, system, convo, specs)
    if (!reply.toolCalls.length) {
      setCallPending(call, null)
      return { reply, pending: [] }
    }

    const parsed = reply.toolCalls.map(parseToolCall)
    const clientCalls = parsed.filter((wanted) => byName.get(wanted.name)?.kind !== 'connector')
    const connectorCalls = parsed.filter((wanted) => byName.get(wanted.name)?.kind === 'connector')

    convo.push({ role: 'assistant', content: reply.text || null, tool_calls: reply.toolCalls })

    for (const wanted of connectorCalls) {
      setCallActivity(call, 'thinking', `running ${wanted.name}`)
      const output = await runConnectorTool(call.tenant_id, byName.get(wanted.name)!, wanted)
      convo.push({ role: 'tool', content: output, tool_call_id: wanted.id })
    }

    if (clientCalls.length) {
      // The caller owes us these. Park the exact conversation so the resumed turn
      // is the same one, not a re-derived approximation of it.
      setCallPending(call, JSON.stringify({ messages: convo, calls: clientCalls, step }))
      setCallActivity(call, 'thinking', `waiting on ${clientCalls.map((c) => c.name).join(', ')}`)
      return { reply, pending: clientCalls }
    }
  }

  // Out of steps. Answer with what the model has rather than looping in a caller's ear.
  setCallPending(call, null)
  const reply = await callModel(route, system, convo, [])
  return { reply, pending: [] }
}

async function runConnectorTool(tenantId: string, tool: ToolRow, wanted: ToolCall): Promise<string> {
  if (!tool.connector_id) return 'This tool is not connected to anything.'
  const connector = getConnector(tenantId, tool.connector_id)
  if (!connector || connector.revoked_at) return 'That connector is no longer connected.'
  try {
    const accessToken =
      connector.auth_kind === 'none' ? undefined : await useConnectorToken(tenantId, tool.connector_id)
    if (connector.auth_kind !== 'none' && !accessToken) {
      return 'That connector needs to be connected again.'
    }
    const output = await callRemoteTool(
      connector.server_url,
      accessToken,
      tool.remote_name || tool.name,
      wanted.arguments,
    )
    return output.text
  } catch (error) {
    // A tool failure is a turn the agent can still speak through, so the model is
    // told plainly and the detail stays in the server log.
    console.error('connector tool failed', tool.name, error)
    return error instanceof McpError ? error.message : 'That tool failed.'
  }
}

function routeFor(
  call: CallRow,
  agent: AgentRow | undefined,
  override: ModelRef | undefined,
): ModelRoute | undefined {
  if (!agent) return undefined
  const chosen = Boolean(override || (call.model_provider && call.model_name) || agent.model_provider)
  try {
    return resolveModelRoute({ tenantId: call.tenant_id, agent, call, override })
  } catch (error) {
    // A tenant that picked a model must see why it did not run. A tenant that
    // picked nothing gets the fallback line instead of a failed call.
    if (chosen || !(error instanceof ModelRouteError)) throw error
    return undefined
  }
}

function finish(
  call: CallRow,
  result: ReplyResult,
  pending: ToolCall[],
  started: number,
): CompleteResult {
  const llmMs = Date.now() - started
  const tool = pending[0]?.name ?? result.ranTools[0]
  appendTurn(call, {
    speaker: 'AGENT',
    text: result.text,
    tool,
    v2vMs: llmMs,
    llmMs,
    model: result.fallback ? undefined : result.label,
    activity: pending.length ? 'thinking' : 'speaking',
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
    toolCalls: pending,
  }
}

interface PendingState {
  messages: ChatMessage[]
  calls: ToolCall[]
  step: number
}

function readPending(call: CallRow): PendingState | undefined {
  if (!call.pending_tools_json) return undefined
  try {
    return JSON.parse(call.pending_tools_json) as PendingState
  } catch {
    return undefined
  }
}

function parseToolCall(raw: RawToolCall): ToolCall {
  let args: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(raw.function.arguments || '{}')
    if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>
  } catch {
    // A model that emits malformed JSON gets empty arguments rather than a dead
    // turn; the tool itself reports what it needed.
  }
  return { id: raw.id, name: raw.function.name, arguments: args }
}

interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

function toolSpec(tool: ToolRow): ToolSpec {
  let parameters: unknown = { type: 'object', properties: {} }
  try {
    parameters = JSON.parse(tool.params_json)
  } catch {
    // normaliseParams guards this on write; a hand-edited row lands here.
  }
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters },
  }
}

/**
 * The eval path. It takes the same route resolution and the same fetch a real turn
 * takes, so the latency an eval reports is the latency a caller would get. It
 * creates no call row: an eval is not traffic and must not reach the monitor. Tools
 * are left out on purpose, because an eval has no client to run one.
 */
export async function replyForEval(input: {
  tenantId: string
  agent: AgentRow
  system: string
  utterance: string
}): Promise<{ text: string; fallback: boolean }> {
  const messages: ChatMessage[] = [{ role: 'user', content: input.utterance }]
  let route: ModelRoute | undefined
  try {
    route = resolveModelRoute({ tenantId: input.tenantId, agent: input.agent })
  } catch (error) {
    if (!(error instanceof ModelRouteError)) throw error
  }
  const result = route ? await callModel(route, input.system, messages, []) : fallbackReply(messages)
  return { text: result.text, fallback: result.fallback }
}

interface ReplyResult {
  text: string
  model: string
  provider: string
  label: string
  source: ModelSource | 'none'
  fallback: boolean
  toolCalls: RawToolCall[]
  /** Tools already answered in this conversation, for the audit trail. */
  ranTools: string[]
}

/**
 * One fetch for every provider. They all speak the OpenAI chat-completions shape,
 * which is the reason the catalogue is restricted to providers that do, and the
 * reason tool calling needs no per-provider branch here.
 */
async function callModel(
  route: ModelRoute,
  system: string,
  messages: ChatMessage[],
  tools: ToolSpec[],
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
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
    }),
  })
  if (!res.ok) {
    // A provider error body can carry vendor detail and echo the request, so it
    // stays in the server log and the caller gets the status only.
    console.error('model request failed', route.provider, res.status, (await res.text()).slice(0, 400))
    throw new Error(`Model request failed (${res.status}).`)
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: RawToolCall[] } }[]
  }
  const message = body.choices?.[0]?.message
  const toolCalls = (message?.tool_calls ?? []).filter(
    (entry) => entry?.type === 'function' && typeof entry.function?.name === 'string',
  )
  const text = message?.content?.trim() ?? ''
  // A turn that only calls a tool carries no text, and that is correct, not empty.
  if (!text && !toolCalls.length) throw new Error('The model returned an empty reply.')
  return {
    text,
    model: route.model,
    provider: route.provider,
    label: route.label,
    source: route.source,
    fallback: false,
    toolCalls,
    ranTools: namedTools(messages),
  }
}

/** The tool names already answered in this conversation, oldest first. */
function namedTools(messages: ChatMessage[]): string[] {
  const names: string[] = []
  for (const message of messages) {
    if (message.role !== 'assistant' || !message.tool_calls) continue
    for (const call of message.tool_calls) names.push(call.function.name)
  }
  return names
}

function fallbackReply(messages: ChatMessage[]): ReplyResult {
  const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
  return {
    text: `I heard you. ${last ? `You said: "${last.slice(0, 180)}". ` : ''}Connect a model key in the studio to get a live reply.`,
    model: 'fallback',
    provider: 'none',
    label: 'fallback',
    source: 'none',
    fallback: true,
    toolCalls: [],
    ranTools: [],
  }
}

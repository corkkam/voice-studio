import 'server-only'

import { appendTurn, listTurns, setCallActivity } from '@/lib/store/calls'
import { getAgentById } from '@/lib/store/agents'
import { resolveSystemPrompt } from '@/lib/store/knowledge'
import type { CallRow } from '@/lib/store/types'

export interface CompleteResult {
  text: string
  llmMs: number
  model: string
  fallback: boolean
  /** The tool the model asked for, if any. The client executes it, not us. */
  tool?: string
}

const BASE_PROMPT = 'You are a concise voice assistant.'

export async function completeTurn(call: CallRow, userText: string): Promise<CompleteResult> {
  const started = Date.now()
  setCallActivity(call, 'thinking', 'generating reply')
  appendTurn(call, { speaker: 'CALLER', text: userText, activity: 'thinking', activityDetail: 'generating reply' })

  const agent = getAgentById(call.agent_id)
  const history = listTurns(call.id)
  // Grounding text and tool declarations are composed in one place so the
  // /knowledge screen and the runtime can never disagree.
  const resolved = resolveSystemPrompt(
    call.tenant_id,
    call.agent_id,
    agent?.system_prompt || BASE_PROMPT,
  )
  const result = await generateReply({
    system: resolved.system,
    messages: history.map((turn) => ({
      role: turn.speaker === 'AGENT' ? 'assistant' : 'user',
      content: turn.text,
    })),
  })
  const llmMs = Date.now() - started
  const tool = detectTool(result.text, resolved.toolNames)
  appendTurn(call, {
    speaker: 'AGENT',
    text: result.text,
    tool,
    v2vMs: llmMs,
    llmMs,
    activity: 'speaking',
    activityDetail: result.fallback ? 'fallback reply' : `${result.model} · ${llmMs} ms`,
  })
  return { ...result, llmMs, tool }
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

export async function generateReply(input: {
  system: string
  messages: { role: string; content: string }[]
}): Promise<{ text: string; model: string; fallback: boolean }> {
  const key = process.env.XAI_API_KEY
  if (!key) {
    const last = input.messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
    return {
      text: `I heard you. ${last ? `You said: “${last.slice(0, 180)}”. ` : ''}Configure XAI_API_KEY on the control plane to get a live model reply.`,
      model: 'fallback',
      fallback: true,
    }
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.6',
      messages: [{ role: 'system', content: input.system }, ...input.messages],
      stream: false,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Language model request failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = body.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Language model returned an empty reply.')
  return { text, model: 'grok-4.6', fallback: false }
}

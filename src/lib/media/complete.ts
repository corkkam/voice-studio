import 'server-only'

import { appendTurn, listTurns, setCallActivity } from '@/lib/store/calls'
import { getAgentById } from '@/lib/store/agents'
import type { CallRow } from '@/lib/store/types'

export interface CompleteResult {
  text: string
  llmMs: number
  model: string
  fallback: boolean
}

export async function completeTurn(call: CallRow, userText: string): Promise<CompleteResult> {
  const started = Date.now()
  setCallActivity(call, 'thinking', 'generating reply')
  appendTurn(call, { speaker: 'CALLER', text: userText, activity: 'thinking', activityDetail: 'generating reply' })

  const agent = getAgentById(call.agent_id)
  const history = listTurns(call.id)
  const result = await generateReply({
    system: agent?.system_prompt || 'You are a concise voice assistant.',
    messages: history.map((turn) => ({
      role: turn.speaker === 'AGENT' ? 'assistant' : 'user',
      content: turn.text,
    })),
  })
  const llmMs = Date.now() - started
  appendTurn(call, {
    speaker: 'AGENT',
    text: result.text,
    v2vMs: llmMs,
    llmMs,
    activity: 'speaking',
    activityDetail: result.fallback ? 'fallback reply' : `${result.model} · ${llmMs} ms`,
  })
  return { ...result, llmMs }
}

async function generateReply(input: {
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

import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id, sha256, token } from '@/lib/db/ids'
import { publish } from '@/lib/realtime/hub'
import { formatElapsed, type EndedCall, type LiveCall } from '@/lib/data/calls'
import type { CallActivity } from '@/lib/activity'
import type { ModelRef } from '@/lib/models/catalog'
import type { CallChannel, CallRow, TurnRow } from '@/lib/store/types'
import { getAgentById } from '@/lib/store/agents'

export interface CreateCallInput {
  tenantId: string
  agentId: string
  channel: CallChannel
  display?: string
  locale?: string
  metadata?: Record<string, unknown>
  /** Overrides the agent's model for this session only. */
  model?: ModelRef
}

export interface CreatedCall {
  call: CallRow
  sessionToken: string
}

const SESSION_MS = 4 * 60 * 60 * 1000

export async function createCall(input: CreateCallInput): Promise<CreatedCall> {
  const agent = await getAgentById(input.agentId)
  if (!agent || agent.tenant_id !== input.tenantId) {
    throw new Error('Agent not found')
  }
  const created = now()
  const callId = id('call')
  const rawToken = `vst_${token()}`
  const display =
    input.display?.trim() ||
    (input.channel === 'macos'
      ? 'macOS client'
      : input.channel === 'studio'
        ? 'Studio test'
        : input.channel === 'api'
          ? 'API session'
          : 'Web visitor')

  await run(
    `INSERT INTO calls (
      id, tenant_id, agent_id, channel, display, locale, status, activity,
      activity_detail, started_at, ended_at, v2v_ms, barge_ins, outcome, sentiment, metadata_json,
      model_provider, model_name, model_credential_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'live', 'connecting', ?, ?, NULL, NULL, 0, NULL, 'flat', ?, ?, ?, ?)`,
    [
      callId,
      input.tenantId,
      input.agentId,
      input.channel,
      display,
      input.locale || agent.locale,
      `${input.channel} · connecting`,
      created,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.model?.provider ?? null,
      input.model?.model ?? null,
      input.model?.credentialId ?? null,
    ],
  )
  await run(`INSERT INTO session_tokens (token_hash, call_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)`, [
    sha256(rawToken),
    callId,
    input.tenantId,
    created + SESSION_MS,
  ])

  publish(input.tenantId, { type: 'call.upsert', callId })
  return { call: (await getCall(input.tenantId, callId))!, sessionToken: rawToken }
}

export function getCall(tenantId: string, callId: string): Promise<CallRow | undefined> {
  return one<CallRow>('SELECT * FROM calls WHERE id = ? AND tenant_id = ?', [callId, tenantId])
}

export function getCallById(callId: string): Promise<CallRow | undefined> {
  return one<CallRow>('SELECT * FROM calls WHERE id = ?', [callId])
}

export async function resolveSessionToken(
  raw: string,
): Promise<{ call: CallRow; tenantId: string } | undefined> {
  const found = await one<{ tenant_id: string; expires_at: number; call_id: string }>(
    `SELECT t.tenant_id, t.expires_at, t.call_id
     FROM session_tokens t WHERE t.token_hash = ?`,
    [sha256(raw)],
  )
  if (!found || found.expires_at < now()) return undefined
  const call = await getCall(found.tenant_id, found.call_id)
  if (!call) return undefined
  return { call, tenantId: found.tenant_id }
}

export async function listLiveCalls(tenantId: string): Promise<LiveCall[]> {
  const found = await all<CallRow>(
    `SELECT * FROM calls WHERE tenant_id = ? AND status = 'live' ORDER BY started_at DESC`,
    [tenantId],
  )
  return Promise.all(found.map((item) => toLiveCall(item)))
}

export async function listEndedCalls(tenantId: string, limit = 40): Promise<EndedCall[]> {
  const found = await all<CallRow>(
    `SELECT * FROM calls WHERE tenant_id = ? AND status = 'ended'
     ORDER BY ended_at DESC LIMIT ?`,
    [tenantId, limit],
  )
  return Promise.all(found.map(toEndedCall))
}

export async function countLive(tenantId: string): Promise<number> {
  const found = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM calls WHERE tenant_id = ? AND status = 'live'`,
    [tenantId],
  )
  return Number(found?.n) || 0
}

export function listTurns(callId: string): Promise<TurnRow[]> {
  return all<TurnRow>('SELECT * FROM call_turns WHERE call_id = ? ORDER BY seq ASC', [callId])
}

export async function appendTurn(
  call: CallRow,
  input: {
    speaker: 'AGENT' | 'CALLER'
    text: string
    tool?: string
    v2vMs?: number
    llmMs?: number
    model?: string
    activity?: CallActivity
    activityDetail?: string
  },
): Promise<TurnRow> {
  const seqRow = await one<{ n: number }>(
    'SELECT COALESCE(MAX(seq), 0) AS n FROM call_turns WHERE call_id = ?',
    [call.id],
  )
  const seq = Number(seqRow?.n) + 1
  const turn: TurnRow = {
    id: id('trn'),
    call_id: call.id,
    seq,
    at_ms: now() - call.started_at,
    speaker: input.speaker,
    text: input.text,
    tool: input.tool ?? null,
    v2v_ms: input.v2vMs ?? null,
    stt_ms: null,
    llm_ms: input.llmMs ?? null,
    tts_ms: null,
    model: input.model ?? null,
  }
  await run(
    `INSERT INTO call_turns (id, call_id, seq, at_ms, speaker, text, tool, v2v_ms, stt_ms, llm_ms, tts_ms, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      turn.id,
      turn.call_id,
      turn.seq,
      turn.at_ms,
      turn.speaker,
      turn.text,
      turn.tool,
      turn.v2v_ms,
      turn.stt_ms,
      turn.llm_ms,
      turn.tts_ms,
      turn.model,
    ],
  )

  const activity = input.activity ?? (input.speaker === 'CALLER' ? 'thinking' : 'speaking')
  const detail = input.activityDetail ?? (input.speaker === 'CALLER' ? 'awaiting reply' : 'agent turn')
  const v2v = input.v2vMs ?? call.v2v_ms
  await run(`UPDATE calls SET activity = ?, activity_detail = ?, v2v_ms = COALESCE(?, v2v_ms) WHERE id = ?`, [
    activity,
    detail,
    v2v,
    call.id,
  ])

  publish(call.tenant_id, { type: 'turn', callId: call.id })
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
  return turn
}

/** Switches the model for the rest of a live session. The turns already spoken keep theirs. */
export async function setCallModel(call: CallRow, model: ModelRef | null): Promise<CallRow | undefined> {
  await run(`UPDATE calls SET model_provider = ?, model_name = ?, model_credential_id = ? WHERE id = ?`, [
    model?.provider ?? null,
    model?.model ?? null,
    model?.credentialId ?? null,
    call.id,
  ])
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
  return getCall(call.tenant_id, call.id)
}

export async function setCallActivity(
  call: CallRow,
  activity: CallActivity,
  detail: string,
): Promise<void> {
  await run(`UPDATE calls SET activity = ?, activity_detail = ? WHERE id = ?`, [
    activity,
    detail,
    call.id,
  ])
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
}

export async function endCall(call: CallRow, outcome = 'Session ended'): Promise<CallRow> {
  const ended = now()
  await run(
    `UPDATE calls SET status = 'ended', ended_at = ?, activity = 'idle',
     activity_detail = 'ended', outcome = ? WHERE id = ?`,
    [ended, outcome, call.id],
  )
  await run('DELETE FROM session_tokens WHERE call_id = ?', [call.id])
  publish(call.tenant_id, { type: 'call.ended', callId: call.id })
  return (await getCall(call.tenant_id, call.id))!
}

export async function toLiveCall(row: CallRow): Promise<LiveCall> {
  const [agent, turns] = await Promise.all([getAgentById(row.agent_id), listTurns(row.id)])
  const last = turns.slice(-2)
  return {
    id: row.id,
    display: row.display,
    agent: agent?.name ?? 'Agent',
    locale: `${row.locale} · ${channelLabel(row.channel)}`,
    elapsedSec: Math.max(0, Math.floor((now() - row.started_at) / 1000)),
    v2vMs: row.v2v_ms ?? 0,
    activity: row.activity,
    activityDetail: row.activity_detail,
    lines: last.map((turn, i) => ({
      at: clock(turn.at_ms),
      text: turn.text,
      tone: i === last.length - 1 ? 'current' : 'prior',
    })),
    chips: [
      { label: channelLabel(row.channel), tone: 'neutral' },
      { label: `turn ${turns.length}`, tone: 'muted' },
    ],
    footLeft: agent ? `${agent.name} · v${agent.version}` : row.channel,
    footRight: row.v2v_ms ? `${row.v2v_ms} ms last` : 'waiting',
    footTone: (row.v2v_ms ?? 0) > 900 ? 'alert' : 'good',
    actions: ['Open', 'Transcript', 'Hang up'],
    alert: (row.v2v_ms ?? 0) > 900,
  }
}

export async function toEndedCall(row: CallRow): Promise<EndedCall> {
  const agent = await getAgentById(row.agent_id)
  const durationMs = (row.ended_at ?? now()) - row.started_at
  return {
    id: row.id,
    number: row.display,
    agent: agent?.name ?? 'Agent',
    duration: formatElapsed(Math.max(0, Math.floor(durationMs / 1000))),
    v2v: row.v2v_ms ? `${row.v2v_ms} ms` : '—',
    v2vOver: (row.v2v_ms ?? 0) > 900,
    barge: String(row.barge_ins),
    outcome: row.outcome || 'Ended',
    outcomeTone: row.outcome?.toLowerCase().includes('error') ? 'muted' : 'good',
  }
}

export function channelLabel(channel: CallChannel): string {
  switch (channel) {
    case 'macos':
      return 'macOS'
    case 'studio':
      return 'Studio'
    case 'api':
      return 'API'
    default:
      return 'Web'
  }
}

function clock(atMs: number): string {
  const total = Math.max(0, Math.floor(atMs / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export interface LiveSnapshot {
  live: LiveCall[]
  ended: EndedCall[]
  liveCount: number
}

export async function getSnapshot(tenantId: string): Promise<LiveSnapshot> {
  const [live, ended] = await Promise.all([listLiveCalls(tenantId), listEndedCalls(tenantId, 12)])
  return { live, ended, liveCount: live.length }
}

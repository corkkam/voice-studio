import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id, token } from '@/lib/db/ids'
import { sha256 } from '@/lib/auth/password'
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

export function createCall(input: CreateCallInput): CreatedCall {
  const db = getDb()
  const agent = getAgentById(input.agentId)
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

  db.prepare(
    `INSERT INTO calls (
      id, tenant_id, agent_id, channel, display, locale, status, activity,
      activity_detail, started_at, ended_at, v2v_ms, barge_ins, outcome, sentiment, metadata_json,
      model_provider, model_name, model_credential_id
    ) VALUES (?, ?, ?, ?, ?, ?, 'live', 'connecting', ?, ?, NULL, NULL, 0, NULL, 'flat', ?, ?, ?, ?)`,
  ).run(
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
  )
  db.prepare(
    `INSERT INTO session_tokens (token_hash, call_id, tenant_id, expires_at) VALUES (?, ?, ?, ?)`,
  ).run(sha256(rawToken), callId, input.tenantId, created + SESSION_MS)

  publish(input.tenantId, { type: 'call.upsert', callId })
  return { call: getCall(input.tenantId, callId)!, sessionToken: rawToken }
}

export function getCall(tenantId: string, callId: string): CallRow | undefined {
  return row<CallRow>(
    getDb().prepare('SELECT * FROM calls WHERE id = ? AND tenant_id = ?').get(callId, tenantId),
  )
}

export function getCallById(callId: string): CallRow | undefined {
  return row<CallRow>(getDb().prepare('SELECT * FROM calls WHERE id = ?').get(callId))
}

export function resolveSessionToken(raw: string): { call: CallRow; tenantId: string } | undefined {
  const row = getDb()
    .prepare(
      `SELECT t.tenant_id, t.expires_at, t.call_id
       FROM session_tokens t WHERE t.token_hash = ?`,
    )
    .get(sha256(raw)) as { tenant_id: string; expires_at: number; call_id: string } | undefined
  if (!row || row.expires_at < now()) return undefined
  const call = getCall(row.tenant_id, row.call_id)
  if (!call) return undefined
  return { call, tenantId: row.tenant_id }
}

export function listLiveCalls(tenantId: string): LiveCall[] {
  return rows<CallRow>(
    getDb()
      .prepare(`SELECT * FROM calls WHERE tenant_id = ? AND status = 'live' ORDER BY started_at DESC`)
      .all(tenantId),
  ).map((item) => toLiveCall(item))
}

export function listEndedCalls(tenantId: string, limit = 40): EndedCall[] {
  return rows<CallRow>(
    getDb()
      .prepare(
        `SELECT * FROM calls WHERE tenant_id = ? AND status = 'ended'
         ORDER BY ended_at DESC LIMIT ?`,
      )
      .all(tenantId, limit),
  ).map(toEndedCall)
}

export function countLive(tenantId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM calls WHERE tenant_id = ? AND status = 'live'`)
    .get(tenantId) as { n: number }
  return Number(row.n) || 0
}

export function listTurns(callId: string): TurnRow[] {
  return rows<TurnRow>(
    getDb().prepare('SELECT * FROM call_turns WHERE call_id = ? ORDER BY seq ASC').all(callId),
  )
}

export function appendTurn(
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
): TurnRow {
  const db = getDb()
  const seqRow = db.prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM call_turns WHERE call_id = ?').get(call.id) as {
    n: number
  }
  const seq = Number(seqRow.n) + 1
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
  db.prepare(
    `INSERT INTO call_turns (id, call_id, seq, at_ms, speaker, text, tool, v2v_ms, stt_ms, llm_ms, tts_ms, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
  )

  const activity = input.activity ?? (input.speaker === 'CALLER' ? 'thinking' : 'speaking')
  const detail = input.activityDetail ?? (input.speaker === 'CALLER' ? 'awaiting reply' : 'agent turn')
  const v2v = input.v2vMs ?? call.v2v_ms
  db.prepare(
    `UPDATE calls SET activity = ?, activity_detail = ?, v2v_ms = COALESCE(?, v2v_ms) WHERE id = ?`,
  ).run(activity, detail, v2v, call.id)

  publish(call.tenant_id, { type: 'turn', callId: call.id })
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
  return turn
}

/** Switches the model for the rest of a live session. The turns already spoken keep theirs. */
export function setCallModel(call: CallRow, model: ModelRef | null): CallRow | undefined {
  getDb()
    .prepare(
      `UPDATE calls SET model_provider = ?, model_name = ?, model_credential_id = ? WHERE id = ?`,
    )
    .run(model?.provider ?? null, model?.model ?? null, model?.credentialId ?? null, call.id)
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
  return getCall(call.tenant_id, call.id)
}

export function setCallActivity(call: CallRow, activity: CallActivity, detail: string): void {
  getDb()
    .prepare(`UPDATE calls SET activity = ?, activity_detail = ? WHERE id = ?`)
    .run(activity, detail, call.id)
  publish(call.tenant_id, { type: 'call.upsert', callId: call.id })
}

export function endCall(call: CallRow, outcome = 'Session ended'): CallRow {
  const ended = now()
  getDb()
    .prepare(
      `UPDATE calls SET status = 'ended', ended_at = ?, activity = 'idle',
       activity_detail = 'ended', outcome = ? WHERE id = ?`,
    )
    .run(ended, outcome, call.id)
  getDb().prepare('DELETE FROM session_tokens WHERE call_id = ?').run(call.id)
  publish(call.tenant_id, { type: 'call.ended', callId: call.id })
  return getCall(call.tenant_id, call.id)!
}

export function toLiveCall(row: CallRow): LiveCall {
  const agent = getAgentById(row.agent_id)
  const turns = listTurns(row.id)
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

export function toEndedCall(row: CallRow): EndedCall {
  const agent = getAgentById(row.agent_id)
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

export function getSnapshot(tenantId: string): LiveSnapshot {
  const live = listLiveCalls(tenantId)
  return {
    live,
    ended: listEndedCalls(tenantId, 12),
    liveCount: live.length,
  }
}

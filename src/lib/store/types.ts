import type { CallActivity } from '@/lib/activity'
import type { PipelineStage } from '@/lib/data/defaults'

export type AgentStatus = 'live' | 'draft'
export type KeyKind = 'secret' | 'publishable'
export type CallChannel = 'web' | 'macos' | 'api' | 'studio'
export type CallStatus = 'live' | 'ended'

export interface UserRow {
  id: string
  email: string
  password_hash: string
  name: string
  created_at: number
}

export interface TenantRow {
  id: string
  name: string
  slug: string
  region: string
  owner_id: string
  created_at: number
}

export interface AgentRow {
  id: string
  tenant_id: string
  name: string
  slug: string
  locale: string
  locale_tone: 'neutral' | 'risk'
  summary: string
  status: AgentStatus
  pipeline_json: string
  series: string
  carrier: string
  system_prompt: string
  topology: 'cascaded' | 's2s'
  version: number
  created_at: number
  updated_at: number
  published_at: number | null
}

export interface ApiKeyRow {
  id: string
  tenant_id: string
  name: string
  prefix: string
  key_hash: string
  kind: KeyKind
  origins_json: string | null
  last_used_at: number | null
  created_at: number
  revoked_at: number | null
}

export interface CallRow {
  id: string
  tenant_id: string
  agent_id: string
  channel: CallChannel
  display: string
  locale: string
  status: CallStatus
  activity: CallActivity
  activity_detail: string
  started_at: number
  ended_at: number | null
  v2v_ms: number | null
  barge_ins: number
  outcome: string | null
  sentiment: 'up' | 'down' | 'flat' | null
  metadata_json: string | null
}

export interface TurnRow {
  id: string
  call_id: string
  seq: number
  at_ms: number
  speaker: 'AGENT' | 'CALLER'
  text: string
  tool: string | null
  v2v_ms: number | null
  stt_ms: number | null
  llm_ms: number | null
  tts_ms: number | null
}

export interface CampaignRow {
  id: string
  tenant_id: string
  agent_id: string | null
  name: string
  status: string
  created_at: number
}

export interface SessionTokenRow {
  token_hash: string
  call_id: string
  tenant_id: string
  expires_at: number
}

export function parsePipeline(json: string): PipelineStage[] {
  try {
    const parsed = JSON.parse(json) as PipelineStage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

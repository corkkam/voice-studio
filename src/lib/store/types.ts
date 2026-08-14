import type { CallActivity } from '@/lib/activity'
import type { PipelineStage } from '@/lib/data/defaults'

export type AgentStatus = 'live' | 'draft'
export type KeyKind = 'secret' | 'publishable'
export type CallChannel = 'web' | 'macos' | 'api' | 'studio'
export type CallStatus = 'live' | 'ended'

export interface UserRow {
  id: string
  clerk_user_id: string | null
  email: string
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
  voice_id: string | null
  version: number
  /** Empty means no choice made, which resolves to the platform model. */
  model_provider: string
  model_name: string
  model_credential_id: string | null
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
  /** Set when the session overrides the agent's model. Null follows the agent. */
  model_provider: string | null
  model_name: string | null
  model_credential_id: string | null
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
  /** provider/model that produced an agent turn, for the audit trail. */
  model: string | null
}

export interface ProviderCredentialRow {
  id: string
  tenant_id: string
  provider: string
  label: string
  base_url: string
  secret_enc: string
  hint: string
  created_at: number
  updated_at: number
  last_used_at: number | null
  revoked_at: number | null
}

/** What leaves the store. The encrypted secret never does. */
export type ProviderCredential = Omit<ProviderCredentialRow, 'secret_enc'>

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

/** A voice is a preset the client resolves against a real device voice. */
export interface VoiceRow {
  id: string
  tenant_id: string
  name: string
  locale: string
  family_hint: string
  rate: number
  pitch: number
  note: string
  is_default: number
  created_at: number
  updated_at: number
}

export interface KnowledgeSnippetRow {
  id: string
  tenant_id: string
  name: string
  body: string
  scope_all: number
  created_at: number
  updated_at: number
}

export interface ToolRow {
  id: string
  tenant_id: string
  name: string
  description: string
  params_json: string
  created_at: number
  updated_at: number
}

export type NumberIntentKind = 'did_inbound' | 'sip_outbound' | 'sip_inbound'

export interface NumberIntentRow {
  id: string
  tenant_id: string
  name: string
  note: string
  kind: NumberIntentKind
  agent_id: string | null
  region: string
  created_at: number
}

export type AssertionKind = 'contains' | 'not_contains' | 'max_sentences'

export interface EvalCaseRow {
  id: string
  tenant_id: string
  agent_id: string
  name: string
  utterance: string
  assertion_kind: AssertionKind
  assertion_value: string
  max_ms: number | null
  created_at: number
}

export interface EvalRunRow {
  id: string
  tenant_id: string
  agent_id: string
  agent_version: number
  started_at: number
  finished_at: number | null
  passed: number
  total: number
  p95_ms: number | null
}

export interface EvalResultRow {
  id: string
  run_id: string
  case_id: string
  case_name: string
  utterance: string
  assertion: string
  reply: string
  turn_ms: number | null
  pass: number
  detail: string
}

export interface AgentPolicyRow {
  agent_id: string
  tenant_id: string
  disclosure: string
  retention_days: number
  redact_pii: number
  updated_at: number
}

export function parsePipeline(json: string): PipelineStage[] {
  try {
    const parsed = JSON.parse(json) as PipelineStage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

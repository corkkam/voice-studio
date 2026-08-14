import 'server-only'

import { getProvider, modelLabel, type ModelRef, type ProviderId } from '@/lib/models/catalog'
import { findCredential, getCredential, useCredentialSecret } from '@/lib/store/credentials'
import type { AgentRow, CallRow } from '@/lib/store/types'

/*
 * One resolution order, used by every turn:
 *
 *   request override  ->  session override  ->  agent setting  ->  platform key
 *
 * The first three are a tenant choice and need a tenant credential. The last is the
 * platform paying, and exists so a fresh tenant gets a working reply before it brings
 * a key of its own.
 */
export type ModelSource = 'request' | 'session' | 'agent' | 'platform'

export interface ModelRoute {
  provider: ProviderId
  model: string
  baseUrl: string
  apiKey: string
  credentialId: string | null
  source: ModelSource
  /** provider/model, safe to store on a turn and show to the operator. */
  label: string
}

export class ModelRouteError extends Error {}

export function resolveModelRoute(input: {
  tenantId: string
  agent: AgentRow
  call?: CallRow
  override?: ModelRef
}): ModelRoute {
  const { tenantId, agent, call, override } = input

  if (override) return byoRoute(tenantId, override, 'request')
  if (call?.model_provider && call.model_name) {
    return byoRoute(
      tenantId,
      { provider: call.model_provider as ProviderId, model: call.model_name, credentialId: call.model_credential_id ?? undefined },
      'session',
    )
  }
  if (agent.model_provider && agent.model_name) {
    return byoRoute(
      tenantId,
      { provider: agent.model_provider as ProviderId, model: agent.model_name, credentialId: agent.model_credential_id ?? undefined },
      'agent',
    )
  }
  return platformRoute()
}

/**
 * Checks a reference without spending a turn on it. Session open and agent save both
 * call this, so a bad choice fails at configuration time rather than mid-call.
 */
export function assertRoutable(tenantId: string, ref: ModelRef): void {
  byoRoute(tenantId, ref, 'request')
}

function byoRoute(tenantId: string, ref: ModelRef, source: ModelSource): ModelRoute {
  const provider = getProvider(ref.provider)
  if (!provider) throw new ModelRouteError('Unknown model provider.')

  const credential = ref.credentialId
    ? getCredential(tenantId, ref.credentialId)
    : findCredential(tenantId, provider.id)

  if (!credential || credential.revoked_at) {
    // A platform-funded provider still works without a tenant key of its own.
    const platform = platformKeyFor(provider.id)
    if (platform) {
      return {
        provider: provider.id,
        model: ref.model,
        baseUrl: provider.baseUrl,
        apiKey: platform,
        credentialId: null,
        source,
        label: modelLabel(provider.id, ref.model),
      }
    }
    throw new ModelRouteError('No live key for that model provider. Add one under Keys.')
  }

  const secret = useCredentialSecret(tenantId, credential.id)
  if (!secret) throw new ModelRouteError('No live key for that model provider. Add one under Keys.')

  return {
    provider: provider.id,
    model: ref.model,
    baseUrl: credential.base_url || provider.baseUrl,
    apiKey: secret,
    credentialId: credential.id,
    source,
    label: modelLabel(provider.id, ref.model),
  }
}

function platformKeyFor(providerId: ProviderId): string | undefined {
  const env = getProvider(providerId)?.platformKeyEnv
  return env ? process.env[env]?.trim() || undefined : undefined
}

/** The reply a tenant gets before it has chosen anything. */
export const PLATFORM_MODEL: { provider: ProviderId; model: string } = {
  provider: 'xai',
  model: 'grok-4.6',
}

function platformRoute(): ModelRoute {
  const provider = getProvider(PLATFORM_MODEL.provider)!
  const apiKey = platformKeyFor(PLATFORM_MODEL.provider)
  if (!apiKey) throw new ModelRouteError('No model is configured on this control plane.')
  return {
    provider: provider.id,
    model: PLATFORM_MODEL.model,
    baseUrl: provider.baseUrl,
    apiKey,
    credentialId: null,
    source: 'platform',
    label: modelLabel(provider.id, PLATFORM_MODEL.model),
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/session'
import { createAgent, getAgentRow, setAgentVoice, updateAgent } from '@/lib/store/agents'
import { createCampaign } from '@/lib/store/campaigns'
import { createKey, revokeKey } from '@/lib/store/keys'
import { createVoice, deleteVoice, setDefaultVoice, updateVoice } from '@/lib/store/voices'
import {
  createSnippet,
  createTool,
  deleteSnippet,
  deleteTool,
  updateSnippet,
  updateTool,
} from '@/lib/store/knowledge'
import {
  createConnector,
  deleteConnector,
  revokeConnector,
} from '@/lib/store/connectors'
import { beginConnectorAuth, syncConnectorTools } from '@/lib/connectors/service'
import { ConnectorAuthError } from '@/lib/connectors/oauth'
import { createNumberIntent, deleteNumberIntent } from '@/lib/store/numbers'
import { createCase, deleteCase, runSuite } from '@/lib/store/evals'
import { purgeExpiredCalls, savePolicy } from '@/lib/store/policies'
import { createCredential, revokeCredential } from '@/lib/store/credentials'
import { hasCredentialSecret } from '@/lib/db/secrets'
import { parseModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'

export type FormState =
  | { error?: string; secret?: string; saved?: boolean; note?: string }
  | undefined

export async function createAgentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the agent a name.' }
  const agent = createAgent(auth.tenant.id, {
    name,
    locale: String(form.get('locale') ?? 'en').trim(),
    summary: String(form.get('summary') ?? '').trim(),
    prompt: String(form.get('prompt') ?? '').trim(),
  })
  redirect(`/agents/${agent.id}`)
}

export async function saveAgentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const agentId = String(form.get('agentId') ?? '')
  if (!getAgentRow(auth.tenant.id, agentId)) return { error: 'Agent not found.' }
  updateAgent(auth.tenant.id, agentId, {
    name: String(form.get('name') ?? ''),
    summary: String(form.get('summary') ?? ''),
    locale: String(form.get('locale') ?? ''),
    system_prompt: String(form.get('prompt') ?? ''),
  })
  revalidatePath(`/agents/${agentId}`)
  revalidatePath('/agents')
  return undefined
}

export async function publishAgentAction(agentId: string): Promise<void> {
  const auth = await requireAuth()
  updateAgent(auth.tenant.id, agentId, { status: 'live' })
  revalidatePath(`/agents/${agentId}`)
  revalidatePath('/agents')
}

export async function createKeyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const kind = String(form.get('kind') ?? 'secret') === 'publishable' ? 'publishable' : 'secret'
  const name = String(form.get('name') ?? '').trim()
  const { secret } = createKey(auth.tenant.id, { name, kind })
  revalidatePath('/keys')
  return { secret }
}

export async function revokeKeyAction(keyId: string): Promise<void> {
  const auth = await requireAuth()
  revokeKey(auth.tenant.id, keyId)
  revalidatePath('/keys')
}

/**
 * A provider key is stored encrypted, not hashed, because every turn has to present
 * it again. It is never read back into a response after this action returns.
 */
export async function addCredentialAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  if (!hasCredentialSecret()) {
    return { error: 'Credential storage is not configured on this control plane.' }
  }
  const secret = String(form.get('secret') ?? '').trim()
  if (!secret) return { error: 'Paste the provider key.' }
  try {
    createCredential(auth.tenant.id, {
      provider: String(form.get('provider') ?? ''),
      label: String(form.get('label') ?? '').trim(),
      secret,
      baseUrl: String(form.get('baseUrl') ?? '').trim(),
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not save that key.' }
  }
  revalidatePath('/keys')
  return { saved: true }
}

export async function revokeCredentialAction(credentialId: string): Promise<void> {
  const auth = await requireAuth()
  revokeCredential(auth.tenant.id, credentialId)
  revalidatePath('/keys')
}

/** Sets the model an agent runs on. An empty provider puts it back on the platform model. */
export async function saveAgentModelAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const agentId = String(form.get('agentId') ?? '')
  if (!getAgentRow(auth.tenant.id, agentId)) return { error: 'Agent not found.' }

  const provider = String(form.get('provider') ?? '').trim()
  const model = String(form.get('model') ?? '').trim()
  const credentialId = String(form.get('credentialId') ?? '').trim()

  if (!provider) {
    updateAgent(auth.tenant.id, agentId, { model_provider: '', model_name: '', model_credential_id: null })
    revalidatePath(`/agents/${agentId}`)
    revalidatePath('/agents')
    return { saved: true }
  }

  const ref = parseModelRef({ provider, model, credentialId: credentialId || undefined })
  if (!ref) return { error: 'Pick a provider and give a model id.' }
  try {
    assertRoutable(auth.tenant.id, ref)
  } catch (error) {
    if (error instanceof ModelRouteError) return { error: error.message }
    throw error
  }
  updateAgent(auth.tenant.id, agentId, {
    model_provider: ref.provider,
    model_name: ref.model,
    model_credential_id: ref.credentialId ?? null,
  })
  revalidatePath(`/agents/${agentId}`)
  revalidatePath('/agents')
  return { saved: true }
}

export async function createCampaignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the campaign a name.' }
  const agentId = String(form.get('agentId') ?? '') || undefined
  const campaign = createCampaign(auth.tenant.id, { name, agentId })
  redirect(`/campaigns/${campaign.id}`)
}

/* Voices */

export async function createVoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the preset a name.' }
  createVoice(auth.tenant.id, {
    name,
    locale: String(form.get('locale') ?? 'en-IN'),
    familyHint: String(form.get('familyHint') ?? 'any'),
    rate: Number(form.get('rate') ?? 1),
    pitch: Number(form.get('pitch') ?? 1),
    note: String(form.get('note') ?? ''),
  })
  revalidatePath('/voices')
  return undefined
}

export async function updateVoiceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const voiceId = String(form.get('voiceId') ?? '')
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the preset a name.' }
  updateVoice(auth.tenant.id, voiceId, {
    name,
    locale: String(form.get('locale') ?? ''),
    familyHint: String(form.get('familyHint') ?? ''),
    rate: Number(form.get('rate') ?? 1),
    pitch: Number(form.get('pitch') ?? 1),
    note: String(form.get('note') ?? ''),
  })
  revalidatePath('/voices')
  return undefined
}

export async function setDefaultVoiceAction(voiceId: string): Promise<void> {
  const auth = await requireAuth()
  setDefaultVoice(auth.tenant.id, voiceId)
  revalidatePath('/voices')
}

export async function deleteVoiceAction(voiceId: string): Promise<void> {
  const auth = await requireAuth()
  deleteVoice(auth.tenant.id, voiceId)
  revalidatePath('/voices')
  revalidatePath('/agents')
}

export async function bindAgentVoiceAction(agentId: string, voiceId: string): Promise<void> {
  const auth = await requireAuth()
  setAgentVoice(auth.tenant.id, agentId, voiceId || null)
  revalidatePath('/voices')
  revalidatePath(`/agents/${agentId}`)
}

/* Knowledge and tools */

export async function createSnippetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  const body = String(form.get('body') ?? '').trim()
  if (name.length < 2) return { error: 'Give the snippet a name.' }
  if (!body) return { error: 'A snippet with no text would add nothing to the prompt.' }
  createSnippet(auth.tenant.id, {
    name,
    body,
    scopeAll: String(form.get('scopeAll') ?? '') === 'on',
    agentIds: form.getAll('agentIds').map(String).filter(Boolean),
  })
  revalidatePath('/knowledge')
  return undefined
}

export async function updateSnippetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const snippetId = String(form.get('snippetId') ?? '')
  const body = String(form.get('body') ?? '').trim()
  if (!body) return { error: 'A snippet with no text would add nothing to the prompt.' }
  updateSnippet(auth.tenant.id, snippetId, {
    name: String(form.get('name') ?? ''),
    body,
    scopeAll: String(form.get('scopeAll') ?? '') === 'on',
    agentIds: form.getAll('agentIds').map(String).filter(Boolean),
  })
  revalidatePath('/knowledge')
  return undefined
}

export async function deleteSnippetAction(snippetId: string): Promise<void> {
  const auth = await requireAuth()
  deleteSnippet(auth.tenant.id, snippetId)
  revalidatePath('/knowledge')
}

export async function createToolAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(name)) {
    return { error: 'Use a lower-case function name, letters, digits and underscore.' }
  }
  const description = String(form.get('description') ?? '').trim()
  if (!description) {
    // The description is how the model decides to call it at all, so an empty one
    // is a tool that never fires.
    return { error: 'Say when the model should call this tool.' }
  }
  const agentIds = form.getAll('agentIds').map(String).filter(Boolean)
  const scopeAll = String(form.get('scopeAll') ?? '') === 'on'
  if (!scopeAll && agentIds.length === 0) {
    return { error: 'Choose the agents, or make it available to every agent.' }
  }
  createTool(auth.tenant.id, {
    name,
    description,
    params: String(form.get('params') ?? ''),
    kind: 'client',
    scopeAll,
    agentIds,
  })
  revalidatePath('/knowledge')
  return undefined
}

export async function updateToolAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const toolId = String(form.get('toolId') ?? '')
  const agentIds = form.getAll('agentIds').map(String).filter(Boolean)
  const scopeAll = String(form.get('scopeAll') ?? '') === 'on'
  if (!scopeAll && agentIds.length === 0) {
    return { error: 'Choose the agents, or make it available to every agent.' }
  }
  updateTool(auth.tenant.id, toolId, {
    description: String(form.get('description') ?? ''),
    params: form.get('params') === null ? undefined : String(form.get('params')),
    scopeAll,
    agentIds,
  })
  revalidatePath('/knowledge')
  return undefined
}

export async function deleteToolAction(toolId: string): Promise<void> {
  const auth = await requireAuth()
  deleteTool(auth.tenant.id, toolId)
  revalidatePath('/knowledge')
}

/* Connectors */

export async function createConnectorAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  if (!hasCredentialSecret()) {
    return { error: 'Credential storage is not configured on this control plane.' }
  }
  const authKind = String(form.get('authKind') ?? 'oauth')
  if (authKind !== 'oauth' && authKind !== 'bearer' && authKind !== 'none') {
    return { error: 'Choose how the server authenticates.' }
  }
  try {
    createConnector(auth.tenant.id, {
      name: String(form.get('name') ?? ''),
      serverUrl: String(form.get('serverUrl') ?? ''),
      authKind,
      bearerToken: String(form.get('bearerToken') ?? ''),
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That connector could not be added.' }
  }
  revalidatePath('/connectors')
  return { saved: true }
}

/**
 * Sends the operator to the authorization server. The redirect leaves this action,
 * so it returns nothing on success; `redirect` throws by design.
 */
export async function connectConnectorAction(connectorId: string): Promise<FormState> {
  const auth = await requireAuth()
  const head = await headers()
  const host = head.get('x-forwarded-host') || head.get('host') || 'localhost:3000'
  const proto = head.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')

  let target: string
  try {
    target = await beginConnectorAuth(auth.tenant.id, connectorId, `${proto}://${host}`)
  } catch (error) {
    const message =
      error instanceof ConnectorAuthError ? error.message : 'That server could not be reached.'
    return { error: message }
  }
  redirect(target)
}

export async function syncConnectorAction(connectorId: string): Promise<FormState> {
  const auth = await requireAuth()
  try {
    const count = await syncConnectorTools(auth.tenant.id, connectorId)
    revalidatePath('/connectors')
    revalidatePath('/knowledge')
    return { note: `${count} tools imported. Scope them before an agent can use them.` }
  } catch (error) {
    revalidatePath('/connectors')
    return { error: error instanceof Error ? error.message : 'That connector did not answer.' }
  }
}

export async function revokeConnectorAction(connectorId: string): Promise<void> {
  const auth = await requireAuth()
  revokeConnector(auth.tenant.id, connectorId)
  revalidatePath('/connectors')
  revalidatePath('/knowledge')
}

export async function deleteConnectorAction(connectorId: string): Promise<void> {
  const auth = await requireAuth()
  // The tool rows go with it through ON DELETE CASCADE, which is what an operator
  // means by removing a connector.
  deleteConnector(auth.tenant.id, connectorId)
  revalidatePath('/connectors')
  revalidatePath('/knowledge')
}

/* Numbers and SIP */

export async function createNumberIntentAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Name the line you mean to provision.' }
  createNumberIntent(auth.tenant.id, {
    name,
    note: String(form.get('note') ?? ''),
    kind: String(form.get('kind') ?? 'did_inbound'),
    agentId: String(form.get('agentId') ?? ''),
    region: String(form.get('region') ?? 'IN-SOUTH'),
  })
  revalidatePath('/numbers')
  return undefined
}

export async function deleteNumberIntentAction(intentId: string): Promise<void> {
  const auth = await requireAuth()
  deleteNumberIntent(auth.tenant.id, intentId)
  revalidatePath('/numbers')
}

/* Evals */

export async function createCaseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const agentId = String(form.get('agentId') ?? '')
  const name = String(form.get('name') ?? '').trim()
  const utterance = String(form.get('utterance') ?? '').trim()
  if (name.length < 2) return { error: 'Give the case a name.' }
  if (!utterance) return { error: 'A case needs something for the caller to say.' }
  const maxMsRaw = String(form.get('maxMs') ?? '').trim()
  const created = createCase(auth.tenant.id, {
    agentId,
    name,
    utterance,
    assertionKind: String(form.get('assertionKind') ?? 'contains'),
    assertionValue: String(form.get('assertionValue') ?? ''),
    maxMs: maxMsRaw ? Number(maxMsRaw) : null,
  })
  if (!created) return { error: 'Pick an agent that exists in this workspace.' }
  revalidatePath('/evals')
  return undefined
}

export async function deleteCaseAction(caseId: string): Promise<void> {
  const auth = await requireAuth()
  deleteCase(auth.tenant.id, caseId)
  revalidatePath('/evals')
}

export async function runSuiteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const agentId = String(form.get('agentId') ?? '')
  const outcome = await runSuite(auth.tenant.id, agentId)
  revalidatePath('/evals')
  if (outcome.error) return { error: outcome.error }
  return { note: `${outcome.passed} of ${outcome.total} passed.` }
}

/* Compliance */

export async function savePolicyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const agentId = String(form.get('agentId') ?? '')
  savePolicy(auth.tenant.id, agentId, {
    disclosure: String(form.get('disclosure') ?? ''),
    retentionDays: Number(form.get('retentionDays') ?? 30),
    redactPii: String(form.get('redactPii') ?? '') === 'on',
  })
  revalidatePath('/compliance')
  revalidatePath('/campaigns')
  return undefined
}

/*
 * Deletion of real audit rows, so it is an explicit confirmed action and never
 * optimistic. The count comes back so the screen reports what actually went.
 */
export async function purgeExpiredAction(_prev: FormState): Promise<FormState> {
  const auth = await requireAuth()
  const deleted = purgeExpiredCalls(auth.tenant.id)
  revalidatePath('/compliance')
  revalidatePath('/calls')
  return { note: deleted === 0 ? 'Nothing was past its window.' : `Deleted ${deleted} call(s).` }
}

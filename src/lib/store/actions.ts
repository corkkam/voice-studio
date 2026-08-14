'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/session'
import { createAgent, getAgentRow, updateAgent } from '@/lib/store/agents'
import { createCampaign } from '@/lib/store/campaigns'
import { createKey, revokeKey } from '@/lib/store/keys'
import { createCredential, revokeCredential } from '@/lib/store/credentials'
import { hasCredentialSecret } from '@/lib/db/secrets'
import { parseModelRef } from '@/lib/models/catalog'
import { assertRoutable, ModelRouteError } from '@/lib/models/route'

export type FormState = { error?: string; secret?: string; saved?: boolean } | undefined

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

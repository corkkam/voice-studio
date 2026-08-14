'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/session'
import { createAgent, getAgentRow, updateAgent } from '@/lib/store/agents'
import { createCampaign } from '@/lib/store/campaigns'
import { createKey, revokeKey } from '@/lib/store/keys'

export type FormState = { error?: string; secret?: string } | undefined

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

export async function createCampaignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = await requireAuth()
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Give the campaign a name.' }
  const agentId = String(form.get('agentId') ?? '') || undefined
  const campaign = createCampaign(auth.tenant.id, { name, agentId })
  redirect(`/campaigns/${campaign.id}`)
}

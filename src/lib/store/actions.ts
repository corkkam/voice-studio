'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/session'
import { createAgent, getAgentRow, setAgentVoice, updateAgent } from '@/lib/store/agents'
import { createCampaign } from '@/lib/store/campaigns'
import { createKey, revokeKey } from '@/lib/store/keys'
import { createVoice, deleteVoice, setDefaultVoice, updateVoice } from '@/lib/store/voices'
import { createSnippet, createTool, deleteSnippet, deleteTool, updateSnippet } from '@/lib/store/knowledge'
import { createNumberIntent, deleteNumberIntent } from '@/lib/store/numbers'
import { createCase, deleteCase, runSuite } from '@/lib/store/evals'
import { purgeExpiredCalls, savePolicy } from '@/lib/store/policies'

export type FormState = { error?: string; secret?: string; note?: string } | undefined

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
  createTool(auth.tenant.id, {
    name,
    description: String(form.get('description') ?? ''),
    params: String(form.get('params') ?? ''),
  })
  revalidatePath('/knowledge')
  return undefined
}

export async function deleteToolAction(toolId: string): Promise<void> {
  const auth = await requireAuth()
  deleteTool(auth.tenant.id, toolId)
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

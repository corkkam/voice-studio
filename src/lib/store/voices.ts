import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { VoiceRow } from '@/lib/store/types'

export interface VoiceInput {
  name: string
  locale?: string
  familyHint?: string
  rate?: number
  pitch?: number
  note?: string
}

export function listVoices(tenantId: string): Promise<VoiceRow[]> {
  return all<VoiceRow>(
    'SELECT * FROM voices WHERE tenant_id = ? ORDER BY is_default DESC, created_at ASC',
    [tenantId],
  )
}

export function getVoice(tenantId: string, voiceId: string): Promise<VoiceRow | undefined> {
  return one<VoiceRow>('SELECT * FROM voices WHERE id = ? AND tenant_id = ?', [voiceId, tenantId])
}

/** The preset an agent speaks with, or the tenant default when it has none. */
export async function resolveVoice(
  tenantId: string,
  voiceId: string | null,
): Promise<VoiceRow | undefined> {
  if (voiceId) {
    const bound = await getVoice(tenantId, voiceId)
    if (bound) return bound
  }
  return one<VoiceRow>('SELECT * FROM voices WHERE tenant_id = ? AND is_default = 1 LIMIT 1', [
    tenantId,
  ])
}

export async function createVoice(tenantId: string, input: VoiceInput): Promise<VoiceRow> {
  const created = now()
  const first = !(await one('SELECT 1 FROM voices WHERE tenant_id = ? LIMIT 1', [tenantId]))
  const voice: VoiceRow = {
    id: id('vce'),
    tenant_id: tenantId,
    name: input.name.trim(),
    locale: (input.locale || 'en-IN').trim(),
    family_hint: (input.familyHint || 'any').trim(),
    rate: clamp(input.rate ?? 1, 0.5, 2),
    pitch: clamp(input.pitch ?? 1, 0.5, 2),
    note: (input.note || '').trim(),
    // The first preset in a workspace becomes the default, so an agent that
    // never picks one still resolves to something the client can speak with.
    is_default: first ? 1 : 0,
    created_at: created,
    updated_at: created,
  }
  await run(
    `INSERT INTO voices (
      id, tenant_id, name, locale, family_hint, rate, pitch, note, is_default,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      voice.id,
      voice.tenant_id,
      voice.name,
      voice.locale,
      voice.family_hint,
      voice.rate,
      voice.pitch,
      voice.note,
      voice.is_default,
      voice.created_at,
      voice.updated_at,
    ],
  )
  return voice
}

export async function updateVoice(
  tenantId: string,
  voiceId: string,
  input: VoiceInput,
): Promise<VoiceRow | undefined> {
  const existing = await getVoice(tenantId, voiceId)
  if (!existing) return undefined
  await run(
    `UPDATE voices SET name = ?, locale = ?, family_hint = ?, rate = ?, pitch = ?,
     note = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [
      input.name.trim() || existing.name,
      (input.locale || existing.locale).trim(),
      (input.familyHint || existing.family_hint).trim(),
      clamp(input.rate ?? existing.rate, 0.5, 2),
      clamp(input.pitch ?? existing.pitch, 0.5, 2),
      (input.note ?? existing.note).trim(),
      now(),
      voiceId,
      tenantId,
    ],
  )
  return getVoice(tenantId, voiceId)
}

export async function setDefaultVoice(tenantId: string, voiceId: string): Promise<void> {
  if (!(await getVoice(tenantId, voiceId))) return
  await run('UPDATE voices SET is_default = 0 WHERE tenant_id = ?', [tenantId])
  await run('UPDATE voices SET is_default = 1, updated_at = ? WHERE id = ? AND tenant_id = ?', [
    now(),
    voiceId,
    tenantId,
  ])
}

/*
 * Deleting a preset unbinds every agent that used it rather than failing. The
 * agents then fall back to the tenant default through resolveVoice.
 */
export async function deleteVoice(tenantId: string, voiceId: string): Promise<void> {
  const existing = await getVoice(tenantId, voiceId)
  if (!existing) return
  await run('UPDATE agents SET voice_id = NULL WHERE tenant_id = ? AND voice_id = ?', [
    tenantId,
    voiceId,
  ])
  await run('DELETE FROM voices WHERE id = ? AND tenant_id = ?', [voiceId, tenantId])
  if (existing.is_default) {
    const next = await one<VoiceRow>(
      'SELECT * FROM voices WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
      [tenantId],
    )
    if (next) await setDefaultVoice(tenantId, next.id)
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
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

export function listVoices(tenantId: string): VoiceRow[] {
  return rows<VoiceRow>(
    getDb()
      .prepare('SELECT * FROM voices WHERE tenant_id = ? ORDER BY is_default DESC, created_at ASC')
      .all(tenantId),
  )
}

export function getVoice(tenantId: string, voiceId: string): VoiceRow | undefined {
  return row<VoiceRow>(
    getDb().prepare('SELECT * FROM voices WHERE id = ? AND tenant_id = ?').get(voiceId, tenantId),
  )
}

/** The preset an agent speaks with, or the tenant default when it has none. */
export function resolveVoice(tenantId: string, voiceId: string | null): VoiceRow | undefined {
  if (voiceId) {
    const bound = getVoice(tenantId, voiceId)
    if (bound) return bound
  }
  return row<VoiceRow>(
    getDb()
      .prepare('SELECT * FROM voices WHERE tenant_id = ? AND is_default = 1 LIMIT 1')
      .get(tenantId),
  )
}

export function createVoice(tenantId: string, input: VoiceInput): VoiceRow {
  const db = getDb()
  const created = now()
  const first = !db.prepare('SELECT 1 FROM voices WHERE tenant_id = ? LIMIT 1').get(tenantId)
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
  db.prepare(
    `INSERT INTO voices (
      id, tenant_id, name, locale, family_hint, rate, pitch, note, is_default,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
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
  )
  return voice
}

export function updateVoice(
  tenantId: string,
  voiceId: string,
  input: VoiceInput,
): VoiceRow | undefined {
  const existing = getVoice(tenantId, voiceId)
  if (!existing) return undefined
  getDb()
    .prepare(
      `UPDATE voices SET name = ?, locale = ?, family_hint = ?, rate = ?, pitch = ?,
       note = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      input.name.trim() || existing.name,
      (input.locale || existing.locale).trim(),
      (input.familyHint || existing.family_hint).trim(),
      clamp(input.rate ?? existing.rate, 0.5, 2),
      clamp(input.pitch ?? existing.pitch, 0.5, 2),
      (input.note ?? existing.note).trim(),
      now(),
      voiceId,
      tenantId,
    )
  return getVoice(tenantId, voiceId)
}

export function setDefaultVoice(tenantId: string, voiceId: string): void {
  const db = getDb()
  if (!getVoice(tenantId, voiceId)) return
  db.prepare('UPDATE voices SET is_default = 0 WHERE tenant_id = ?').run(tenantId)
  db.prepare('UPDATE voices SET is_default = 1, updated_at = ? WHERE id = ? AND tenant_id = ?').run(
    now(),
    voiceId,
    tenantId,
  )
}

/*
 * Deleting a preset unbinds every agent that used it rather than failing. The
 * agents then fall back to the tenant default through resolveVoice.
 */
export function deleteVoice(tenantId: string, voiceId: string): void {
  const db = getDb()
  const existing = getVoice(tenantId, voiceId)
  if (!existing) return
  db.prepare('UPDATE agents SET voice_id = NULL WHERE tenant_id = ? AND voice_id = ?').run(
    tenantId,
    voiceId,
  )
  db.prepare('DELETE FROM voices WHERE id = ? AND tenant_id = ?').run(voiceId, tenantId)
  if (existing.is_default) {
    const next = row<VoiceRow>(
      db.prepare('SELECT * FROM voices WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1').get(
        tenantId,
      ),
    )
    if (next) setDefaultVoice(tenantId, next.id)
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

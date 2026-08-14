import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id, token } from '@/lib/db/ids'
import { sha256 } from '@/lib/auth/password'
import type { ApiKeyRow, KeyKind } from '@/lib/store/types'

export function listKeys(tenantId: string): Omit<ApiKeyRow, 'key_hash'>[] {
  return rows<Omit<ApiKeyRow, 'key_hash'>>(
    getDb()
      .prepare(
        `SELECT id, tenant_id, name, prefix, kind, origins_json, last_used_at, created_at, revoked_at
         FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC`,
      )
      .all(tenantId),
  )
}

export function createKey(
  tenantId: string,
  input: { name: string; kind: KeyKind; origins?: string[] },
): { row: Omit<ApiKeyRow, 'key_hash'>; secret: string } {
  const prefixKind = input.kind === 'publishable' ? 'pk' : 'sk'
  const secret = `vs_${prefixKind}_live_${token(24)}`
  const created = now()
  const row: ApiKeyRow = {
    id: id('key'),
    tenant_id: tenantId,
    name: input.name.trim() || (input.kind === 'publishable' ? 'Web / widget' : 'Server / macOS'),
    prefix: secret.slice(0, 16),
    key_hash: sha256(secret),
    kind: input.kind,
    origins_json: input.origins ? JSON.stringify(input.origins) : null,
    last_used_at: null,
    created_at: created,
    revoked_at: null,
  }
  getDb()
    .prepare(
      `INSERT INTO api_keys (
        id, tenant_id, name, prefix, key_hash, kind, origins_json, last_used_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.tenant_id,
      row.name,
      row.prefix,
      row.key_hash,
      row.kind,
      row.origins_json,
      row.last_used_at,
      row.created_at,
      row.revoked_at,
    )
  const { key_hash: _, ...publicRow } = row
  return { row: publicRow, secret }
}

export function revokeKey(tenantId: string, keyId: string): boolean {
  const result = getDb()
    .prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`)
    .run(now(), keyId, tenantId)
  return Number(result.changes) > 0
}

export function resolveApiKey(raw: string): ApiKeyRow | undefined {
  if (!raw.startsWith('vs_')) return undefined
  const found = row<ApiKeyRow>(getDb().prepare(`SELECT * FROM api_keys WHERE key_hash = ?`).get(sha256(raw)))
  if (!found || found.revoked_at) return undefined
  getDb().prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), found.id)
  return found
}

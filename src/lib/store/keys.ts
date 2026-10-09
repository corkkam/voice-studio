import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id, sha256, token } from '@/lib/db/ids'
import type { ApiKeyRow, KeyKind } from '@/lib/store/types'

export function listKeys(tenantId: string): Promise<Omit<ApiKeyRow, 'key_hash'>[]> {
  return all<Omit<ApiKeyRow, 'key_hash'>>(
    `SELECT id, tenant_id, name, prefix, kind, origins_json, last_used_at, created_at, revoked_at
     FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC`,
    [tenantId],
  )
}

export async function createKey(
  tenantId: string,
  input: { name: string; kind: KeyKind; origins?: string[] },
): Promise<{ row: Omit<ApiKeyRow, 'key_hash'>; secret: string }> {
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
  await run(
    `INSERT INTO api_keys (
      id, tenant_id, name, prefix, key_hash, kind, origins_json, last_used_at, created_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ],
  )
  const { key_hash: _, ...publicRow } = row
  return { row: publicRow, secret }
}

export async function revokeKey(tenantId: string, keyId: string): Promise<boolean> {
  const changed = await run(
    `UPDATE api_keys SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`,
    [now(), keyId, tenantId],
  )
  return changed > 0
}

export async function resolveApiKey(raw: string): Promise<ApiKeyRow | undefined> {
  if (!raw.startsWith('vs_')) return undefined
  const found = await one<ApiKeyRow>(`SELECT * FROM api_keys WHERE key_hash = ?`, [sha256(raw)])
  if (!found || found.revoked_at) return undefined
  await run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', [now(), found.id])
  return found
}

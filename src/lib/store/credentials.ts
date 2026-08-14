import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id } from '@/lib/db/ids'
import { decryptSecret, encryptSecret, secretHint } from '@/lib/db/secrets'
import { getProvider } from '@/lib/models/catalog'
import type { ProviderCredential, ProviderCredentialRow } from '@/lib/store/types'

const PUBLIC_COLUMNS = `id, tenant_id, provider, label, base_url, hint,
  created_at, updated_at, last_used_at, revoked_at`

export function listCredentials(tenantId: string): ProviderCredential[] {
  return rows<ProviderCredential>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM provider_credentials
         WHERE tenant_id = ? ORDER BY created_at DESC`,
      )
      .all(tenantId),
  )
}

export function createCredential(
  tenantId: string,
  input: { provider: string; label?: string; secret: string; baseUrl?: string },
): ProviderCredential {
  const provider = getProvider(input.provider)
  if (!provider) throw new Error('Unknown provider.')
  const secret = input.secret.trim()
  if (!secret) throw new Error('Paste the provider key.')
  const baseUrl = (input.baseUrl || provider.baseUrl).trim().replace(/\/$/, '')
  if (!baseUrl) throw new Error('A self hosted provider needs a base URL.')

  const created = now()
  const record: ProviderCredential = {
    id: id('prv'),
    tenant_id: tenantId,
    provider: provider.id,
    label: input.label?.trim() || provider.label,
    base_url: baseUrl,
    hint: secretHint(secret),
    created_at: created,
    updated_at: created,
    last_used_at: null,
    revoked_at: null,
  }
  getDb()
    .prepare(
      `INSERT INTO provider_credentials (
        id, tenant_id, provider, label, base_url, secret_enc, hint,
        created_at, updated_at, last_used_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.tenant_id,
      record.provider,
      record.label,
      record.base_url,
      encryptSecret(secret),
      record.hint,
      record.created_at,
      record.updated_at,
      record.last_used_at,
      record.revoked_at,
    )
  return record
}

export function revokeCredential(tenantId: string, credentialId: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE provider_credentials SET revoked_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`,
    )
    .run(now(), now(), credentialId, tenantId)
  return Number(result.changes) > 0
}

export function getCredential(tenantId: string, credentialId: string): ProviderCredential | undefined {
  return row<ProviderCredential>(
    getDb()
      .prepare(`SELECT ${PUBLIC_COLUMNS} FROM provider_credentials WHERE id = ? AND tenant_id = ?`)
      .get(credentialId, tenantId),
  )
}

/** The newest live credential for a provider, so an agent can name a provider and nothing else. */
export function findCredential(tenantId: string, provider: string): ProviderCredential | undefined {
  return row<ProviderCredential>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_COLUMNS} FROM provider_credentials
         WHERE tenant_id = ? AND provider = ? AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(tenantId, provider),
  )
}

/**
 * The only path that decrypts. Stamps `last_used_at` so a stale key is visible on
 * the keys screen. Callers must not log or return the value.
 */
export function useCredentialSecret(tenantId: string, credentialId: string): string | undefined {
  const found = row<ProviderCredentialRow>(
    getDb()
      .prepare('SELECT * FROM provider_credentials WHERE id = ? AND tenant_id = ?')
      .get(credentialId, tenantId),
  )
  if (!found || found.revoked_at) return undefined
  getDb().prepare('UPDATE provider_credentials SET last_used_at = ? WHERE id = ?').run(now(), found.id)
  return decryptSecret(found.secret_enc)
}

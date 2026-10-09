import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id, token } from '@/lib/db/ids'
import { decryptSecret, encryptSecret } from '@/lib/db/secrets'
import { assertPublicHttpsUrl, refreshToken, type TokenSet } from '@/lib/connectors/oauth'
import type {
  Connector,
  ConnectorAuthKind,
  ConnectorRow,
  ConnectorStatus,
  OAuthStateRow,
} from '@/lib/store/types'

/*
 * The token vault. Connector tokens are wrapped with the same AES-256-GCM helper
 * that wraps provider keys, for the same reason: we have to present the token to
 * the remote server again, so it cannot be hashed.
 *
 * `useConnectorToken` is the only function that unwraps one. Its result must never
 * reach a response, a log line or a view model. Everything else returns `Connector`,
 * which has the wrapped columns removed at the type level.
 */

const PUBLIC_COLUMNS = `id, tenant_id, name, server_url, auth_kind, status, status_detail,
  issuer, authorize_url, token_url, registration_url, client_id, scope, expires_at,
  created_at, updated_at, last_sync_at, revoked_at`

/** Refresh this far before expiry, so a turn never races the clock. */
const REFRESH_MARGIN_MS = 60_000
const STATE_TTL_MS = 10 * 60 * 1000

function decorate(record: Omit<Connector, 'connected'>, hasAccess: boolean): Connector {
  return { ...record, connected: hasAccess && !record.revoked_at }
}

export function listConnectors(tenantId: string): Connector[] {
  const found = rows<Omit<Connector, 'connected'> & { has_access: number }>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_COLUMNS}, access_enc IS NOT NULL AS has_access
         FROM connectors WHERE tenant_id = ? ORDER BY created_at DESC`,
      )
      .all(tenantId),
  )
  return found.map(({ has_access, ...record }) => decorate(record, has_access === 1))
}

export function getConnector(tenantId: string, connectorId: string): Connector | undefined {
  const found = row<Omit<Connector, 'connected'> & { has_access: number }>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_COLUMNS}, access_enc IS NOT NULL AS has_access
         FROM connectors WHERE id = ? AND tenant_id = ?`,
      )
      .get(connectorId, tenantId),
  )
  if (!found) return undefined
  const { has_access, ...record } = found
  return decorate(record, has_access === 1)
}

export function createConnector(
  tenantId: string,
  input: { name: string; serverUrl: string; authKind: ConnectorAuthKind; bearerToken?: string },
): Connector {
  const url = assertPublicHttpsUrl(input.serverUrl.trim())
  const name = input.name.trim()
  if (name.length < 2) throw new Error('Give the connector a name.')

  const created = now()
  const connectorId = id('con')
  const bearer = input.authKind === 'bearer' ? input.bearerToken?.trim() : undefined
  if (input.authKind === 'bearer' && !bearer) {
    throw new Error('Paste the token, or choose OAuth instead.')
  }

  getDb()
    .prepare(
      `INSERT INTO connectors (
        id, tenant_id, name, server_url, auth_kind, status, status_detail,
        issuer, authorize_url, token_url, registration_url, client_id, client_secret_enc,
        scope, access_enc, refresh_enc, expires_at, created_at, updated_at, last_sync_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', '', '', NULL, '', ?, NULL, NULL, ?, ?, NULL, NULL)`,
    )
    .run(
      connectorId,
      tenantId,
      name,
      url.toString().replace(/\/$/, ''),
      input.authKind,
      // A bearer connector is usable the moment it is saved. OAuth needs the round trip.
      bearer ? 'ready' : 'pending',
      bearer ? encryptSecret(bearer) : null,
      created,
      created,
    )
  return getConnector(tenantId, connectorId)!
}

export function setConnectorStatus(
  tenantId: string,
  connectorId: string,
  status: ConnectorStatus,
  detail = '',
): void {
  getDb()
    .prepare(
      'UPDATE connectors SET status = ?, status_detail = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
    )
    .run(status, detail.slice(0, 200), now(), connectorId, tenantId)
}

export function setConnectorClient(
  tenantId: string,
  connectorId: string,
  input: {
    issuer: string
    authorizeUrl: string
    tokenUrl: string
    registrationUrl: string
    clientId: string
    clientSecret?: string
    scope: string
  },
): void {
  getDb()
    .prepare(
      `UPDATE connectors SET issuer = ?, authorize_url = ?, token_url = ?, registration_url = ?,
        client_id = ?, client_secret_enc = ?, scope = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      input.issuer,
      input.authorizeUrl,
      input.tokenUrl,
      input.registrationUrl,
      input.clientId,
      input.clientSecret ? encryptSecret(input.clientSecret) : null,
      input.scope,
      now(),
      connectorId,
      tenantId,
    )
}

export function saveConnectorTokens(tenantId: string, connectorId: string, tokens: TokenSet): void {
  getDb()
    .prepare(
      `UPDATE connectors SET access_enc = ?, refresh_enc = ?, expires_at = ?, scope = ?,
        status = 'ready', status_detail = '', updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      encryptSecret(tokens.accessToken),
      tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      tokens.expiresAt ?? null,
      tokens.scope,
      now(),
      connectorId,
      tenantId,
    )
}

export function markConnectorSynced(tenantId: string, connectorId: string): void {
  getDb()
    .prepare('UPDATE connectors SET last_sync_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .run(now(), now(), connectorId, tenantId)
}

/**
 * Revoking drops the wrapped tokens rather than only flagging the row. A token we
 * keep is a token that can leak, and the operator has already said they are done
 * with it.
 */
export function revokeConnector(tenantId: string, connectorId: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE connectors SET revoked_at = ?, updated_at = ?, access_enc = NULL, refresh_enc = NULL,
        expires_at = NULL, status = 'pending'
       WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`,
    )
    .run(now(), now(), connectorId, tenantId)
  return Number(result.changes) > 0
}

export function deleteConnector(tenantId: string, connectorId: string): void {
  getDb().prepare('DELETE FROM connectors WHERE id = ? AND tenant_id = ?').run(connectorId, tenantId)
}

/**
 * The only path that unwraps a connector token. Refreshes in place when the access
 * token is at or near expiry, so a turn never presents a token the server will
 * reject. Callers must not log or return the result.
 */
export async function useConnectorToken(
  tenantId: string,
  connectorId: string,
): Promise<string | undefined> {
  const found = row<ConnectorRow>(
    getDb().prepare('SELECT * FROM connectors WHERE id = ? AND tenant_id = ?').get(connectorId, tenantId),
  )
  if (!found || found.revoked_at || found.auth_kind === 'none') return undefined
  if (!found.access_enc) return undefined

  const fresh = !found.expires_at || found.expires_at - REFRESH_MARGIN_MS > now()
  if (fresh) return decryptSecret(found.access_enc)

  if (!found.refresh_enc) {
    setConnectorStatus(tenantId, connectorId, 'error', 'The connection expired. Connect it again.')
    return undefined
  }
  try {
    const rotated = await refreshToken({
      tokenUrl: found.token_url,
      refreshToken: decryptSecret(found.refresh_enc),
      clientId: found.client_id,
      clientSecret: found.client_secret_enc ? decryptSecret(found.client_secret_enc) : undefined,
      resource: found.server_url,
    })
    // A server that rotates refresh tokens sends a new one; one that does not
    // expects the old one to keep working, so it is kept.
    saveConnectorTokens(tenantId, connectorId, {
      ...rotated,
      refreshToken: rotated.refreshToken ?? decryptSecret(found.refresh_enc),
    })
    return rotated.accessToken
  } catch (error) {
    console.error('connector refresh failed', connectorId, error)
    setConnectorStatus(tenantId, connectorId, 'error', 'The connection expired. Connect it again.')
    return undefined
  }
}

/* The OAuth round trip. State is single use and short lived. */

export function putOAuthState(input: {
  tenantId: string
  connectorId: string
  verifier: string
  redirectUri: string
  issuer: string
}): string {
  const state = token(24)
  getDb()
    .prepare(
      `INSERT INTO connector_oauth_states (state, tenant_id, connector_id, verifier, redirect_uri, issuer, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      state,
      input.tenantId,
      input.connectorId,
      input.verifier,
      input.redirectUri,
      input.issuer,
      now() + STATE_TTL_MS,
    )
  return state
}

/** Reads and deletes in one step, so a replayed callback finds nothing. */
export function takeOAuthState(state: string): OAuthStateRow | undefined {
  const db = getDb()
  const found = row<OAuthStateRow>(
    db.prepare('SELECT * FROM connector_oauth_states WHERE state = ?').get(state),
  )
  db.prepare('DELETE FROM connector_oauth_states WHERE state = ? OR expires_at < ?').run(state, now())
  if (!found || found.expires_at < now()) return undefined
  return found
}

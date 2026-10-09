import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

/*
 * OAuth 2.1 for remote MCP servers, as the MCP authorization spec asks for it:
 * discovery, dynamic client registration, PKCE, and the `resource` parameter.
 *
 * Nothing here touches the database. The store owns persistence and is the only
 * place a token is wrapped or unwrapped, which is what keeps this file safe to
 * import from anywhere on the server.
 */

export class ConnectorAuthError extends Error {}

export interface AuthServerMetadata {
  issuer: string
  authorizeUrl: string
  tokenUrl: string
  registrationUrl: string
  scope: string
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  /** Epoch ms. Undefined when the server sends no `expires_in`. */
  expiresAt?: number
  scope: string
}

const JSON_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }

/**
 * A connector URL is operator-supplied, so it is the one place an operator could
 * aim this control plane at its own network. HTTPS only, and no host that resolves
 * to a private range.
 */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ConnectorAuthError('The server URL is not a URL.')
  }
  if (url.protocol !== 'https:') {
    throw new ConnectorAuthError('A connector server URL must use https.')
  }
  const host = url.hostname.toLowerCase()
  const blocked =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (blocked) throw new ConnectorAuthError('That host is not reachable from the control plane.')
  return url
}

async function getJson(url: string): Promise<Record<string, unknown> | undefined> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return undefined
    return (await res.json()) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function str(source: Record<string, unknown> | undefined, key: string): string {
  const value = source?.[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Finds the authorization server for an MCP endpoint. The protected-resource
 * document is the spec route; a server that predates it usually still answers the
 * authorization-server document on its own origin, so that is the fallback.
 */
export async function discoverAuthServer(serverUrl: string): Promise<AuthServerMetadata> {
  const url = assertPublicHttpsUrl(serverUrl)
  const path = url.pathname.replace(/^\/|\/$/g, '')

  const resource =
    (await getJson(`${url.origin}/.well-known/oauth-protected-resource${path ? `/${path}` : ''}`)) ??
    (await getJson(`${url.origin}/.well-known/oauth-protected-resource`))

  const servers = Array.isArray(resource?.authorization_servers)
    ? (resource.authorization_servers as unknown[]).filter((v): v is string => typeof v === 'string')
    : []
  const issuerBase = servers[0] ?? url.origin
  const issuerUrl = assertPublicHttpsUrl(issuerBase)
  const issuerPath = issuerUrl.pathname.replace(/^\/|\/$/g, '')

  const metadata =
    (await getJson(
      `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerPath ? `/${issuerPath}` : ''}`,
    )) ??
    (await getJson(`${issuerUrl.origin}/.well-known/oauth-authorization-server`)) ??
    (await getJson(`${issuerBase.replace(/\/$/, '')}/.well-known/openid-configuration`))

  const authorizeUrl = str(metadata, 'authorization_endpoint')
  const tokenUrl = str(metadata, 'token_endpoint')
  if (!authorizeUrl || !tokenUrl) {
    throw new ConnectorAuthError('That server does not advertise an OAuth authorization server.')
  }

  const scopes = Array.isArray(resource?.scopes_supported)
    ? (resource.scopes_supported as unknown[]).filter((v): v is string => typeof v === 'string')
    : []

  return {
    issuer: str(metadata, 'issuer') || issuerBase.replace(/\/$/, ''),
    authorizeUrl,
    tokenUrl,
    registrationUrl: str(metadata, 'registration_endpoint'),
    scope: scopes.join(' '),
  }
}

/**
 * Dynamic client registration. Most remote MCP servers expect it, because there is
 * no human to paste a client id into. `application_type: 'web'` is what stops an
 * authorization server rejecting our redirect.
 */
export async function registerClient(
  registrationUrl: string,
  redirectUri: string,
): Promise<{ clientId: string; clientSecret?: string }> {
  assertPublicHttpsUrl(registrationUrl)
  const res = await fetch(registrationUrl, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      client_name: 'Voice Studio',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
    }),
  })
  if (!res.ok) {
    console.error('connector registration failed', res.status, (await res.text()).slice(0, 400))
    throw new ConnectorAuthError('That server refused to register this control plane.')
  }
  const body = (await res.json()) as Record<string, unknown>
  const clientId = str(body, 'client_id')
  if (!clientId) throw new ConnectorAuthError('That server registered no client id.')
  return { clientId, clientSecret: str(body, 'client_secret') || undefined }
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  }
}

export function authorizeUrlFor(input: {
  authorizeUrl: string
  clientId: string
  redirectUri: string
  challenge: string
  state: string
  scope: string
  resource: string
}): string {
  const url = new URL(input.authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('code_challenge', input.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', input.state)
  // RFC 8707. Without it a server that serves several resources cannot tell which
  // one the token is for, and returns a token our MCP endpoint will reject.
  url.searchParams.set('resource', input.resource)
  if (input.scope) url.searchParams.set('scope', input.scope)
  return url.toString()
}

async function postToken(
  tokenUrl: string,
  form: Record<string, string>,
  clientSecret?: string,
): Promise<TokenSet> {
  const body = new URLSearchParams(form)
  if (clientSecret) body.set('client_secret', clientSecret)
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    // The body can echo the code and the client secret, so it stays server side.
    console.error('connector token exchange failed', res.status, (await res.text()).slice(0, 400))
    throw new ConnectorAuthError('The authorization server rejected the token request.')
  }
  const parsed = (await res.json()) as Record<string, unknown>
  const accessToken = str(parsed, 'access_token')
  if (!accessToken) throw new ConnectorAuthError('The authorization server returned no access token.')
  const expiresIn = typeof parsed.expires_in === 'number' ? parsed.expires_in : undefined
  return {
    accessToken,
    refreshToken: str(parsed, 'refresh_token') || undefined,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
    scope: str(parsed, 'scope'),
  }
}

export function exchangeCode(input: {
  tokenUrl: string
  code: string
  verifier: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  resource: string
}): Promise<TokenSet> {
  return postToken(
    input.tokenUrl,
    {
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.verifier,
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      resource: input.resource,
    },
    input.clientSecret,
  )
}

export function refreshToken(input: {
  tokenUrl: string
  refreshToken: string
  clientId: string
  clientSecret?: string
  resource: string
}): Promise<TokenSet> {
  return postToken(
    input.tokenUrl,
    {
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      resource: input.resource,
    },
    input.clientSecret,
  )
}

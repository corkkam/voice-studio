import 'server-only'

import {
  ConnectorAuthError,
  authorizeUrlFor,
  discoverAuthServer,
  exchangeCode,
  pkcePair,
  registerClient,
} from '@/lib/connectors/oauth'
import { listRemoteTools } from '@/lib/connectors/mcp'
import {
  getConnector,
  markConnectorSynced,
  putOAuthState,
  saveConnectorTokens,
  setConnectorClient,
  setConnectorStatus,
  takeOAuthState,
  useConnectorToken,
} from '@/lib/store/connectors'
import { replaceConnectorTools } from '@/lib/store/knowledge'

/*
 * The three steps of connecting a remote MCP server, in one place so the server
 * action and the callback route cannot drift apart. Everything that touches a
 * token goes through the store; nothing here holds one longer than the call.
 */

export const CALLBACK_PATH = '/api/connectors/callback'

/** Step one: discover, register if needed, and hand back the URL to send the operator to. */
export async function beginConnectorAuth(
  tenantId: string,
  connectorId: string,
  baseUrl: string,
): Promise<string> {
  const connector = getConnector(tenantId, connectorId)
  if (!connector) throw new ConnectorAuthError('That connector does not exist.')
  if (connector.auth_kind !== 'oauth') {
    throw new ConnectorAuthError('That connector does not use OAuth.')
  }

  const redirectUri = `${baseUrl.replace(/\/$/, '')}${CALLBACK_PATH}`
  const metadata = await discoverAuthServer(connector.server_url)

  // Registration is per redirect URI, so a client id from another origin is not
  // reusable. Re-registering is cheap and is what dynamic registration is for.
  let clientId = connector.client_id
  let clientSecret: string | undefined
  if (!clientId && metadata.registrationUrl) {
    const registered = await registerClient(metadata.registrationUrl, redirectUri)
    clientId = registered.clientId
    clientSecret = registered.clientSecret
  }
  if (!clientId) {
    throw new ConnectorAuthError('That server needs a client id and offers no registration.')
  }

  setConnectorClient(tenantId, connectorId, {
    issuer: metadata.issuer,
    authorizeUrl: metadata.authorizeUrl,
    tokenUrl: metadata.tokenUrl,
    registrationUrl: metadata.registrationUrl,
    clientId,
    clientSecret,
    scope: metadata.scope || connector.scope,
  })

  const { verifier, challenge } = pkcePair()
  const state = putOAuthState({
    tenantId,
    connectorId,
    verifier,
    redirectUri,
    issuer: metadata.issuer,
  })

  return authorizeUrlFor({
    authorizeUrl: metadata.authorizeUrl,
    clientId,
    redirectUri,
    challenge,
    state,
    scope: metadata.scope || connector.scope,
    resource: connector.server_url,
  })
}

/**
 * Step two: the operator is back from the authorization server. The state row is
 * single use, and `iss` is checked against what discovery said, per RFC 9207, so a
 * code cannot be redeemed at a server we did not choose.
 */
export async function completeConnectorAuth(input: {
  tenantId: string
  state: string
  code: string
  issuer?: string
}): Promise<string> {
  const parked = takeOAuthState(input.state)
  if (!parked) throw new ConnectorAuthError('That sign-in link has expired. Start again.')
  if (parked.tenant_id !== input.tenantId) {
    throw new ConnectorAuthError('That sign-in belongs to another workspace.')
  }
  if (input.issuer && parked.issuer && input.issuer !== parked.issuer) {
    throw new ConnectorAuthError('The authorization server did not match. Start again.')
  }

  const connector = getConnector(parked.tenant_id, parked.connector_id)
  if (!connector) throw new ConnectorAuthError('That connector does not exist.')

  const tokens = await exchangeCode({
    tokenUrl: connector.token_url,
    code: input.code,
    verifier: parked.verifier,
    clientId: connector.client_id,
    clientSecret: undefined,
    redirectUri: parked.redirect_uri,
    resource: connector.server_url,
  })
  saveConnectorTokens(parked.tenant_id, parked.connector_id, tokens)

  // Importing straight away is what makes the connector useful without a second
  // click, and it proves the token works while the operator is still watching.
  await syncConnectorTools(parked.tenant_id, parked.connector_id)
  return parked.connector_id
}

/** Step three, and the button an operator presses when a server gains a tool. */
export async function syncConnectorTools(tenantId: string, connectorId: string): Promise<number> {
  const connector = getConnector(tenantId, connectorId)
  if (!connector) throw new ConnectorAuthError('That connector does not exist.')
  try {
    const accessToken =
      connector.auth_kind === 'none' ? undefined : await useConnectorToken(tenantId, connectorId)
    if (connector.auth_kind !== 'none' && !accessToken) {
      throw new ConnectorAuthError('That connector is not connected yet.')
    }
    const tools = await listRemoteTools(connector.server_url, accessToken)
    const count = replaceConnectorTools(tenantId, connectorId, tools)
    markConnectorSynced(tenantId, connectorId)
    setConnectorStatus(tenantId, connectorId, 'ready', `${count} tools`)
    return count
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The connector did not answer.'
    setConnectorStatus(tenantId, connectorId, 'error', detail)
    throw error
  }
}

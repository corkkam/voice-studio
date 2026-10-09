import 'server-only'

import { assertPublicHttpsUrl } from '@/lib/connectors/oauth'

/*
 * A small MCP client over Streamable HTTP. We speak MCP ourselves rather than
 * handing a server URL to the model provider, because the hosted-MCP parameter is
 * shaped differently by every vendor that has one. Doing the listing and the call
 * here keeps `src/lib/media/complete.ts` a single OpenAI-shaped fetch and makes
 * connectors work on every provider in the catalogue, self-hosted ones included.
 *
 * Only tools are implemented. Prompts and resources have no surface in this product.
 */

/** Servers negotiate down from this, so an older server still answers. */
const PROTOCOL_VERSION = '2025-06-18'
const CALL_TIMEOUT_MS = 10_000

export class McpError extends Error {}

export interface RemoteTool {
  name: string
  description: string
  /** JSON Schema, passed to the model unchanged. */
  inputSchema: Record<string, unknown>
}

interface RpcResponse {
  id?: number | string
  result?: Record<string, unknown>
  error?: { code?: number; message?: string }
}

/**
 * Streamable HTTP allows either a JSON body or an SSE stream for the same request,
 * and servers pick per response. Both carry the same JSON-RPC envelope.
 */
async function readRpc(res: Response): Promise<RpcResponse | undefined> {
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('application/json')) return (await res.json()) as RpcResponse
  if (!type.includes('text/event-stream')) return undefined

  const body = await res.text()
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    try {
      const parsed = JSON.parse(line.slice(5).trim()) as RpcResponse
      if (parsed.result || parsed.error) return parsed
    } catch {
      // A comment or a keepalive frame. Keep reading.
    }
  }
  return undefined
}

interface Session {
  url: string
  headers: Record<string, string>
}

async function rpc(
  session: Session,
  method: string,
  params: Record<string, unknown> | undefined,
  requestId: number,
): Promise<Record<string, unknown>> {
  const res = await fetch(session.url, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  })
  if (res.status === 401 || res.status === 403) {
    throw new McpError('The connector is not authorised. Connect it again.')
  }
  if (!res.ok) {
    console.error('mcp request failed', method, res.status, (await res.text()).slice(0, 400))
    throw new McpError(`The connector rejected ${method}.`)
  }
  const parsed = await readRpc(res)
  if (parsed?.error) throw new McpError(parsed.error.message || `The connector failed ${method}.`)
  if (!parsed?.result) throw new McpError(`The connector returned nothing for ${method}.`)
  return parsed.result
}

async function open(serverUrl: string, accessToken?: string): Promise<Session> {
  const url = assertPublicHttpsUrl(serverUrl).toString()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Streamable HTTP requires both, because the server chooses the response form.
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'voice-studio', version: '1' },
      },
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  })
  if (res.status === 401 || res.status === 403) {
    throw new McpError('The connector is not authorised. Connect it again.')
  }
  if (!res.ok) {
    console.error('mcp initialize failed', res.status, (await res.text()).slice(0, 400))
    throw new McpError('That server did not answer as an MCP server.')
  }
  await readRpc(res)

  // The session id is how a stateful server ties the following calls to this
  // handshake. A stateless server sends none, and then none is correct to send.
  const sessionId = res.headers.get('mcp-session-id')
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  const session: Session = { url, headers }
  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  }).catch(() => undefined)
  return session
}

export async function listRemoteTools(serverUrl: string, accessToken?: string): Promise<RemoteTool[]> {
  const session = await open(serverUrl, accessToken)
  const result = await rpc(session, 'tools/list', {}, 2)
  const listed = Array.isArray(result.tools) ? result.tools : []
  return listed.flatMap((entry) => {
    const tool = entry as { name?: unknown; description?: unknown; inputSchema?: unknown }
    if (typeof tool.name !== 'string' || !tool.name) return []
    return [
      {
        name: tool.name,
        description: typeof tool.description === 'string' ? tool.description : '',
        inputSchema:
          tool.inputSchema && typeof tool.inputSchema === 'object'
            ? (tool.inputSchema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      },
    ]
  })
}

/**
 * Flattens the MCP content array to the single string the chat-completions tool
 * result carries. Non-text content has no place in a voice turn, so it is named
 * rather than dropped silently.
 */
export async function callRemoteTool(
  serverUrl: string,
  accessToken: string | undefined,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const session = await open(serverUrl, accessToken)
  const result = await rpc(session, 'tools/call', { name, arguments: args }, 3)
  const content = Array.isArray(result.content) ? result.content : []
  const text = content
    .map((entry) => {
      const block = entry as { type?: unknown; text?: unknown }
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      return `[${typeof block.type === 'string' ? block.type : 'unknown'} content]`
    })
    .join('\n')
    .trim()
  return { text: text || 'The tool returned no content.', isError: result.isError === true }
}

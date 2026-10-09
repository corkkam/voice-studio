export type Channel = 'web' | 'macos' | 'api' | 'studio'

/** `"groq/llama-3.1-8b-instant"`, or the object form when you name a stored key. */
export type ModelRef = string | { provider: string; model: string; credentialId?: string }

export interface VoiceStudioOptions {
  baseUrl: string
  apiKey: string
  agentId: string
}

export interface ConnectOptions {
  channel?: Channel
  display?: string
  metadata?: Record<string, unknown>
  /** Overrides the agent's model for this session. Needs a secret key. */
  model?: ModelRef
}

export interface TurnReply {
  reply: string
  llmMs: number
  model: string
  provider: string
  /** request, session, agent or platform. */
  modelSource: string
  fallback: boolean
  /**
   * Tools this app has to run. `sendText` runs the registered ones for you and
   * resolves with the final reply, so this is only ever non-empty when a tool has
   * no handler.
   */
  toolCalls: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** Return anything JSON-serialisable. It goes back to the model as the result. */
export type ToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

export interface ProviderInfo {
  id: string
  label: string
  open: boolean
  models: string[]
  /** False until a key for this provider is stored under Keys. */
  ready: boolean
}

export class VoiceStudio {
  constructor(private readonly opts: VoiceStudioOptions) {}

  private get base(): string {
    return this.opts.baseUrl.replace(/\/$/, '')
  }

  async connect(options: ConnectOptions = {}): Promise<VoiceSession> {
    const res = await fetch(`${this.base}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: this.opts.agentId,
        channel: options.channel ?? 'web',
        display: options.display,
        metadata: options.metadata,
        model: options.model,
      }),
    })
    const data = (await res.json()) as {
      error?: string
      id: string
      token: string
      agent: { id: string; name: string; prompt: string }
      eventsUrl: string
      completeUrl: string
      hangupUrl: string
    }
    if (!res.ok) throw new Error(data.error || 'Failed to open session')
    return new VoiceSession(data, this.opts.apiKey)
  }

  /** Providers and stored keys this tenant can switch to. Secret key only. */
  async models(): Promise<{
    providers: ProviderInfo[]
    credentials: { id: string; provider: string; label: string; hint: string }[]
  }> {
    const res = await fetch(`${this.base}/api/v1/models`, {
      headers: { Authorization: `Bearer ${this.opts.apiKey}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to list models')
    return data
  }

  /** Changes the agent's default, so every session opened after this starts on it. */
  async setAgentModel(model: ModelRef | null): Promise<void> {
    const res = await fetch(`${this.base}/api/v1/agents/${this.opts.agentId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error || 'Failed to set the agent model')
    }
  }
}

type Handler = (payload: unknown) => void

/** Matches MAX_TOOL_STEPS on the server, so the client cannot out-loop the turn. */
const MAX_TOOL_ROUNDS = 3

export class VoiceSession {
  readonly id: string
  readonly token: string
  readonly agent: { id: string; name: string; prompt: string }
  private readonly completeUrl: string
  private readonly hangupUrl: string
  private readonly apiKey: string
  private readonly handlers = new Map<string, Handler[]>()
  private readonly tools = new Map<string, ToolHandler>()
  private source?: EventSource

  constructor(
    data: {
      id: string
      token: string
      agent: { id: string; name: string; prompt: string }
      eventsUrl: string
      completeUrl: string
      hangupUrl: string
    },
    apiKey: string,
  ) {
    this.id = data.id
    this.token = data.token
    this.agent = data.agent
    this.completeUrl = data.completeUrl
    this.hangupUrl = data.hangupUrl
    this.apiKey = apiKey
    if (typeof EventSource !== 'undefined') {
      this.source = new EventSource(data.eventsUrl)
      this.source.onmessage = (event) => {
        try {
          this.emit('event', JSON.parse(event.data))
        } catch {
          // ignore
        }
      }
    }
  }

  on(name: 'event' | 'reply' | 'ended' | 'tool', handler: Handler): this {
    const list = this.handlers.get(name) ?? []
    list.push(handler)
    this.handlers.set(name, list)
    return this
  }

  /**
   * Registers a tool this app can run. The name has to match the tool in the studio.
   * Your handler holds your own credentials and data; nothing about it is sent to
   * the control plane except what it returns.
   */
  tool(name: string, handler: ToolHandler): this {
    this.tools.set(name, handler)
    return this
  }

  /**
   * `options.model` runs this one turn elsewhere without changing the session.
   * If the model calls a tool you registered, this runs it and carries on, so the
   * promise resolves with the spoken answer and not with a half-finished turn.
   */
  async sendText(text: string, options: { model?: ModelRef } = {}): Promise<TurnReply> {
    let data = await this.post({ text, model: options.model }, Boolean(options.model))

    for (let round = 0; round < MAX_TOOL_ROUNDS && data.toolCalls?.length; round += 1) {
      const runnable = data.toolCalls.filter((call) => this.tools.has(call.name))
      if (!runnable.length) break
      this.emit('tool', { calls: runnable })
      const results = await Promise.all(
        runnable.map(async (call) => ({
          id: call.id,
          result: await this.run(call),
        })),
      )
      data = await this.post({ toolResults: results }, false)
    }

    this.emit('reply', data)
    return data
  }

  private async run(call: ToolCall): Promise<string> {
    try {
      const output = await this.tools.get(call.name)!(call.arguments)
      return typeof output === 'string' ? output : JSON.stringify(output ?? null)
    } catch (error) {
      // The model can speak through a failed tool. Throwing here would end the turn.
      return `The tool failed: ${error instanceof Error ? error.message : 'unknown error'}`
    }
  }

  private async post(
    payload: Record<string, unknown>,
    withKey: boolean,
  ): Promise<TurnReply & { error?: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // A session token cannot choose a model; the secret key is what authorises it.
    if (withKey) headers.Authorization = `Bearer ${this.apiKey}`
    const res = await fetch(this.completeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: this.id, token: this.token, ...payload }),
    })
    const data = (await res.json()) as TurnReply & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Turn failed')
    return data
  }

  /**
   * Switches the model for every later turn of this session. Pass null to follow the
   * agent again. The session URL is the same one `hangup` deletes.
   */
  async setModel(model: ModelRef | null): Promise<void> {
    const res = await fetch(this.hangupUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error || 'Failed to switch the model')
    }
  }

  async hangup(): Promise<void> {
    this.source?.close()
    await fetch(this.hangupUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.token}` },
    })
    this.emit('ended', { id: this.id })
  }

  private emit(name: string, payload: unknown) {
    for (const handler of this.handlers.get(name) ?? []) handler(payload)
  }
}

export type Channel = 'web' | 'macos' | 'api' | 'studio'

export interface VoiceStudioOptions {
  baseUrl: string
  apiKey: string
  agentId: string
}

export interface ConnectOptions {
  channel?: Channel
  display?: string
  metadata?: Record<string, unknown>
}

export interface TurnReply {
  reply: string
  llmMs: number
  model: string
  fallback: boolean
}

export class VoiceStudio {
  constructor(private readonly opts: VoiceStudioOptions) {}

  async connect(options: ConnectOptions = {}): Promise<VoiceSession> {
    const baseUrl = this.opts.baseUrl.replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/v1/sessions`, {
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
    return new VoiceSession(data)
  }
}

type Handler = (payload: unknown) => void

export class VoiceSession {
  readonly id: string
  readonly token: string
  readonly agent: { id: string; name: string; prompt: string }
  private readonly completeUrl: string
  private readonly hangupUrl: string
  private readonly handlers = new Map<string, Handler[]>()
  private source?: EventSource

  constructor(data: {
    id: string
    token: string
    agent: { id: string; name: string; prompt: string }
    eventsUrl: string
    completeUrl: string
    hangupUrl: string
  }) {
    this.id = data.id
    this.token = data.token
    this.agent = data.agent
    this.completeUrl = data.completeUrl
    this.hangupUrl = data.hangupUrl
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

  on(name: 'event' | 'reply' | 'ended', handler: Handler): this {
    const list = this.handlers.get(name) ?? []
    list.push(handler)
    this.handlers.set(name, list)
    return this
  }

  async sendText(text: string): Promise<TurnReply> {
    const res = await fetch(this.completeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.id, token: this.token, text }),
    })
    const data = (await res.json()) as TurnReply & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Turn failed')
    this.emit('reply', data)
    return data
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

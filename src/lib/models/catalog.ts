/*
 * Every provider here speaks the OpenAI chat-completions shape, which is what
 * keeps `src/lib/media/complete.ts` a single fetch. A provider that needs its own
 * request body does not belong in this list; it belongs in a decision to move that
 * one file onto the AI SDK.
 *
 * `models` is a starting point for the picker, not a whitelist. Any model id the
 * provider accepts is accepted here, which is what makes an arbitrary open-weight
 * repo on Hugging Face or a self-hosted checkpoint usable.
 */

export type ProviderId =
  | 'xai'
  | 'openai'
  | 'groq'
  | 'together'
  | 'fireworks'
  | 'deepinfra'
  | 'mistral'
  | 'openrouter'
  | 'huggingface'
  | 'custom'

export interface Provider {
  id: ProviderId
  label: string
  /** Empty for `custom`: the credential carries the base URL instead. */
  baseUrl: string
  /** Serves open-weight checkpoints, so the operator can self-host the same model later. */
  open: boolean
  /** Suggestions for the picker. Free text wins. */
  models: string[]
  /** Set only where the platform can pay for the call itself. */
  platformKeyEnv?: string
  keyHint: string
}

export const PROVIDERS: Provider[] = [
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    open: false,
    models: ['grok-4.6', 'grok-4-fast'],
    platformKeyEnv: 'XAI_API_KEY',
    keyHint: 'console.x.ai',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    open: false,
    models: ['gpt-4.1', 'gpt-4.1-mini'],
    keyHint: 'platform.openai.com',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    open: true,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyHint: 'console.groq.com',
  },
  {
    id: 'together',
    label: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    open: true,
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    keyHint: 'api.together.ai',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    open: true,
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
    keyHint: 'fireworks.ai',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    open: true,
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
    keyHint: 'deepinfra.com',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    open: true,
    models: ['mistral-small-latest', 'mistral-large-latest'],
    keyHint: 'console.mistral.ai',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    open: true,
    models: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen-2.5-72b-instruct'],
    keyHint: 'openrouter.ai',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    open: true,
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
    keyHint: 'huggingface.co/settings/tokens',
  },
  {
    id: 'custom',
    label: 'Self hosted',
    baseUrl: '',
    open: true,
    models: [],
    keyHint: 'vLLM, Ollama, TGI or LM Studio on your own URL',
  },
]

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((provider) => provider.id === id)
}

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((provider) => provider.id === value)
}

export interface ModelRef {
  provider: ProviderId
  model: string
  credentialId?: string
}

/**
 * Accepts `{ provider, model }` or the shorthand `groq/llama-3.1-8b-instant`.
 * Model ids carry slashes of their own, so only the first segment is the provider.
 */
export function parseModelRef(value: unknown): ModelRef | undefined {
  if (typeof value === 'string') {
    const cut = value.indexOf('/')
    if (cut < 1) return undefined
    const provider = value.slice(0, cut)
    const model = value.slice(cut + 1).trim()
    if (!isProviderId(provider) || !model) return undefined
    return { provider, model }
  }
  if (!value || typeof value !== 'object') return undefined
  const input = value as { provider?: unknown; model?: unknown; credentialId?: unknown }
  const provider = typeof input.provider === 'string' ? input.provider : ''
  const model = typeof input.model === 'string' ? input.model.trim() : ''
  if (!isProviderId(provider) || !model) return undefined
  return {
    provider,
    model,
    credentialId: typeof input.credentialId === 'string' ? input.credentialId : undefined,
  }
}

export function modelLabel(provider: string, model: string): string {
  return `${provider}/${model}`
}

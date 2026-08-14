import { createHash } from 'node:crypto'

/**
 * One-way hash for anything we store but must never be able to read back:
 * API key secrets and per-session `vst_` tokens.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

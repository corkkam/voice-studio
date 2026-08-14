import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/*
 * API keys are hashed because we never need them back. A provider credential is the
 * opposite: we have to present it to the provider on every turn, so it is encrypted
 * instead. AES-256-GCM, key derived from CREDENTIAL_SECRET.
 *
 * Rotating CREDENTIAL_SECRET makes every stored credential undecryptable. There is no
 * re-wrap path; the operator adds the key again. Say that before you rotate it.
 */
const ENV_NAME = 'CREDENTIAL_SECRET'

export class SecretUnavailableError extends Error {
  constructor() {
    super('Credential storage is not configured on this control plane.')
  }
}

export function hasCredentialSecret(): boolean {
  return Boolean(process.env[ENV_NAME]?.trim())
}

function key(): Buffer {
  const raw = process.env[ENV_NAME]?.trim()
  if (!raw) throw new SecretUnavailableError()
  // Any passphrase length works; the hash gives AES the 32 bytes it needs.
  return createHash('sha256').update(raw).digest()
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    body.toString('base64url'),
  ].join('.')
}

export function decryptSecret(packed: string): string {
  const [version, iv, tag, body] = packed.split('.')
  if (version !== 'v1' || !iv || !tag || !body) {
    throw new Error('Stored credential is unreadable.')
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}

/** Four trailing characters, so an operator can tell two keys apart without holding either. */
export function secretHint(value: string): string {
  const tail = value.trim().slice(-4)
  return tail ? `...${tail}` : '...'
}

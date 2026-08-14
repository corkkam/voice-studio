import { createHash, randomBytes } from 'node:crypto'

export function id(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

export function token(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** API keys and vst_ tokens are stored as hashes only, never as the value. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function slugify(value: string, fallback = 'item'): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || fallback
}

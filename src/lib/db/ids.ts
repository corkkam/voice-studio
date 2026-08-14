import { randomBytes } from 'node:crypto'

export function id(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

export function token(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
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

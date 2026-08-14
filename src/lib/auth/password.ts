import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createHash } from 'node:crypto'

const SCRYPT = { N: 16384, r: 8, p: 1 } as const

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64, SCRYPT).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const next = scryptSync(password, salt, 64, SCRYPT)
  const prev = Buffer.from(hash, 'hex')
  return prev.length === next.length && timingSafeEqual(prev, next)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

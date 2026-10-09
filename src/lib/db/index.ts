import 'server-only'

import { neon, types, type NeonQueryFunction } from '@neondatabase/serverless'

/*
 * Postgres on Neon, over the HTTP endpoint: one round trip per query and no
 * connection to hold open, which is what a Fluid Compute instance wants and what
 * lets several instances share one database. This file is the whole driver
 * surface; SQL itself stays in src/lib/store/*.
 *
 * Placeholders are written as `?`, the shape every query in this repo already
 * used, and rewritten to $1..$n on the way out. That keeps a store function
 * readable and its parameter list positional.
 *
 * The schema is not created here. `pnpm db:push` applies src/lib/db/schema.sql.
 */

/*
 * Epoch milliseconds live in BIGINT columns and COUNT() returns int8. pg-types
 * hands int8 back as a string to keep values above 2^53 exact. Nothing this app
 * stores comes near that, and the row interfaces in src/lib/store/types.ts say
 * `number`, so the parser goes back to Number.
 */
types.setTypeParser(20, (value: string) => Number(value))

export type Param = string | number | boolean | null

type Sql = NeonQueryFunction<false, false>

type GlobalSql = typeof globalThis & { __voiceStudioSql?: Sql }

const globalSql = globalThis as GlobalSql

function client(): Sql {
  if (globalSql.__voiceStudioSql) return globalSql.__voiceStudioSql
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Pull the Neon variables with: vercel env pull .env.local',
    )
  }
  const sql = neon(url)
  globalSql.__voiceStudioSql = sql
  return sql
}

/** A `?` is a placeholder outside a quoted literal and a plain character inside one. */
function toPositional(sql: string): string {
  let out = ''
  let quoted = false
  let n = 0
  for (const character of sql) {
    if (character === "'") quoted = !quoted
    out += character === '?' && !quoted ? `$${(n += 1)}` : character
  }
  return out
}

export async function all<T>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await client().query(toPositional(sql), params)) as T[]
}

export async function one<T>(sql: string, params: Param[] = []): Promise<T | undefined> {
  const found = await all<T>(sql, params)
  return found[0]
}

/** Returns the number of rows written, which is what a revoke or a delete checks. */
export async function run(sql: string, params: Param[] = []): Promise<number> {
  const result = await client().query<false, true>(toPositional(sql), params, {
    fullResults: true,
  })
  return result.rowCount ?? 0
}

export function now(): number {
  return Date.now()
}

#!/usr/bin/env node
/*
 * Applies src/lib/db/schema.sql to the Neon database.
 *
 * This is the only thing that writes DDL. The app never creates a table: several
 * instances share one Postgres database now, so a CREATE TABLE on a cold start
 * would race the other instances, and on a database that already exists it would
 * silently skip a new column.
 *
 * Idempotent. Every statement in the schema is IF NOT EXISTS, so re-running it
 * after adding a table or an ALTER is the supported way to migrate.
 *
 * Usage: pnpm db:push
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon } from '@neondatabase/serverless'

// DDL goes to the direct endpoint. The pooled one runs through pgbouncer in
// transaction mode, which is not where schema changes belong.
const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
const SCHEMA = join(process.cwd(), 'src', 'lib', 'db', 'schema.sql')

if (!URL) {
  console.error(
    'DATABASE_URL is not set. Pull the Neon variables with: vercel env pull .env.local',
  )
  process.exit(1)
}

// The HTTP endpoint takes one command per request, so the file is split. No
// statement in the schema carries a semicolon inside a string literal.
const statements = readFileSync(SCHEMA, 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

const sql = neon(URL)
let applied = 0

for (const statement of statements) {
  try {
    await sql.query(statement)
    applied += 1
  } catch (error) {
    console.error(`\nFailed on:\n${statement}\n`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

const tables = await sql.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name`,
)

console.log(`Applied ${applied} statement(s).`)
console.log(`Tables: ${tables.map((t) => t.table_name).join(', ')}`)

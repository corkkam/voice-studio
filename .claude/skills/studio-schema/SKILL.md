---
name: studio-schema
description: Change the Voice Studio Postgres schema safely. Use when adding or altering a table, column, index or default, when a query fails with "column does not exist" or "relation does not exist", when a number comes back as a string, or when working on the Neon database itself.
---

# Change the schema

## The trap

`src/lib/db/schema.sql` is the only schema authority and every statement in it is
`IF NOT EXISTS`. On a database that already has the table, a column you add to the
`CREATE TABLE` is **never created**. The app then throws `column ... does not exist` at
the first query. There is no migration runner and no version table; `pnpm db:push` runs
the file top to bottom and nothing else writes DDL.

The app itself never creates a table. That is deliberate: local, preview and production
share one Neon database, so DDL on a cold start would race every other instance.

## Procedure

1. Edit the `CREATE TABLE` in `src/lib/db/schema.sql` so a fresh database is correct.
2. Add the matching idempotent `ALTER` at the bottom of the same file, under the
   migrations comment, so a database that already exists converges:

   ```sql
   -- Existing databases predate this column; CREATE TABLE IF NOT EXISTS will not add it.
   ALTER TABLE agents ADD COLUMN IF NOT EXISTS greeting TEXT NOT NULL DEFAULT '';
   ```

   Unlike SQLite, Postgres can drop and retype a column in place, but a destructive
   change hits shared data. Branch the Neon project first and say so.
3. Update `src/lib/store/types.ts`. The row interfaces are hand-written mirrors of the
   SQL; nothing generates them, so a drifted type compiles and lies.
4. Update every hand-written `INSERT` and `UPDATE` column list in `src/lib/store/*`.
   They are positional: the `?` placeholders are rewritten to `$1..$n` in order, so a
   missing placeholder shifts every value after it.
5. Add an index if the column is used in a `WHERE` on `calls` or `call_turns`. Those
   two tables are the ones that grow.
6. Apply and verify:

   ```bash
   pnpm db:push        # idempotent, prints the statement count and the table list
   pnpm typecheck
   pnpm dev & pnpm seed
   ```

## Rules

- Every table except `users` and `tenants` carries `tenant_id`, and every query filters
  on it. A store function that takes a bare id and no tenant is a cross-tenant read.
  `getAgentById` and `getCallById` exist only for token-authenticated paths that
  already resolved a tenant; do not call them from an operator surface.
- **Types matter more than they did.** Epoch milliseconds are `BIGINT`, flags are
  `INTEGER` holding 0 or 1, latency is `INTEGER`, a rate or a pitch is
  `DOUBLE PRECISION`. `src/lib/db/index.ts` parses int8 back to `number`; anything that
  lands in `NUMERIC` (a bare `SUM`, for one) arrives as a **string** instead, so cast it
  in SQL: `SUM(x)::bigint`.
- **Integer overflow is an error, not a wrap.** `retention_days * 86400000` overflows
  int4 and Postgres raises. Cast first: `COALESCE(p.retention_days, ?)::bigint * 86400000`.
- **A bare parameter has no type.** `? - started_at` fails where `?::bigint - started_at`
  works. Cast a parameter that is not compared to a column.
- **There is no `rowid`.** Anything that needs insertion order needs its own column, as
  `eval_results.seq` does.
- Foreign keys are on. Order your inserts.
- Timestamps are integer epoch milliseconds from `now()`. No SQL `now()`, no ISO strings.
- Money and latency stay integers.
- If the change is only ever needed for local demo data, put it in `scripts/seed.mjs`
  instead of the schema.

## The database itself

One Neon project, the Vercel Marketplace resource `voice-studio-db`, connected to all
three environments of the Vercel project. A laptop, a preview deploy and production
read the same rows. Before anything destructive, branch it, and name the blast radius.

`DATABASE_URL` is the pooled endpoint and is what the app uses. `DATABASE_URL_UNPOOLED`
is the direct one and is what `pnpm db:push` uses, because schema changes do not belong
on a pgbouncer transaction-mode connection.

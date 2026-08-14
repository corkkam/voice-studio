---
name: studio-schema
description: Change the Voice Studio SQLite schema safely. Use when adding or altering a table, column, index or default, when a query fails with "no such column", when data seems to disappear between runs, or when planning the move off node:sqlite.
---

# Change the schema

## The trap

`bootstrap()` in `src/lib/db/index.ts` is the only schema authority and it runs
`CREATE TABLE IF NOT EXISTS`. On a database that already exists, a column you add to
that SQL is **never created**. The app starts clean, then throws `no such column` at
the first query, or writes `NULL` where you expected a default. There is no migration
runner and no version table.

## Procedure

1. Edit the `CREATE TABLE` in `bootstrap()` so a fresh database is correct. This is the
   source of truth for anyone cloning the repo.
2. Add the matching `ALTER` next to it, guarded so it is idempotent, so existing local
   databases and any developer mid-branch converge:

   ```ts
   // Existing databases predate this column; CREATE TABLE IF NOT EXISTS will not add it.
   const cols = db.prepare('PRAGMA table_info(agents)').all() as { name: string }[]
   if (!cols.some((c) => c.name === 'greeting')) {
     db.exec("ALTER TABLE agents ADD COLUMN greeting TEXT NOT NULL DEFAULT ''")
   }
   ```

   SQLite cannot drop or retype a column in place. A destructive change means create,
   copy, drop, rename inside one transaction, or a local database reset.
3. Update `src/lib/store/types.ts`. The row interfaces are hand-written mirrors of the
   SQL; nothing generates them, so a drifted type compiles and lies.
4. Update every hand-written `INSERT` and `UPDATE` column list in `src/lib/store/*`.
   They are positional. A missing placeholder shifts every value after it.
5. Add an index if the column is used in a `WHERE` on `calls` or `call_turns`. Those
   two tables are the ones that grow.
6. Verify against both states, because they fail differently:

   ```bash
   pnpm typecheck
   # existing database
   pnpm dev & pnpm seed
   # fresh database
   rm -f data/voice-studio.db*; pnpm dev & pnpm seed
   node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('data/voice-studio.db');console.log(d.prepare('PRAGMA table_info(agents)').all())"
   ```

## Rules

- Every table except `users`, `tenants` and `sessions` carries `tenant_id`, and every
  query filters on it. A store function that takes a bare id and no tenant is a
  cross-tenant read. `getAgentById` and `getCallById` exist only for token-authenticated
  paths that already resolved a tenant; do not call them from an operator surface.
- Foreign keys are on (`PRAGMA foreign_keys = ON`). Order your inserts.
- Timestamps are integer epoch milliseconds from `now()`. No SQL `datetime`, no ISO
  strings.
- Money and latency stay integers.
- If the change is only ever needed for local demo data, put it in `scripts/seed.mjs`
  instead of the schema.

## The bigger move

`node:sqlite` on a local file is single-process and single-machine, which is what blocks
any hosted release (see landmine 2 in `AGENTS.md`). If the task is that migration, treat
it as its own change: the store modules are the seam, so keep every SQL string inside
`src/lib/store/*` while you work, and do not spread queries into routes or pages.

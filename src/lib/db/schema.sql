-- Voice Studio schema, Postgres.
--
-- Applied by `pnpm db:push`, which is idempotent and safe to re-run. Nothing
-- creates a table at runtime any more: DDL on a cold start races every other
-- instance, and on a database that already has the table CREATE TABLE IF NOT
-- EXISTS silently ignores a new column, which is how a column ends up missing
-- and the app fails at query time instead of at deploy time.
--
-- Adding a column means two edits in this file: put it in the CREATE TABLE so a
-- fresh database is right, and add an ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- at the bottom so a database that already exists converges. Then update the row
-- interface in src/lib/store/types.ts and every INSERT column list that touches
-- the table.
--
-- Types: epoch milliseconds are BIGINT and come back as numbers because
-- src/lib/db/index.ts parses int8. Flags are INTEGER holding 0 or 1, which is
-- what the row interfaces declare. Money and latency stay integers.
--
-- The migrate script splits this file on semicolons, so no statement may contain
-- one inside a string literal.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk ON users(clerk_user_id);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT 'IN-SOUTH',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  locale_tone TEXT NOT NULL DEFAULT 'neutral',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  pipeline_json TEXT NOT NULL,
  series TEXT NOT NULL DEFAULT 'Web / SDK',
  carrier TEXT NOT NULL DEFAULT 'Web + macOS',
  system_prompt TEXT NOT NULL DEFAULT '',
  topology TEXT NOT NULL DEFAULT 'cascaded',
  voice_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  model_provider TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  model_credential_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  published_at BIGINT,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS provider_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  secret_enc TEXT NOT NULL,
  hint TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  last_used_at BIGINT,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  origins_json TEXT,
  last_used_at BIGINT,
  created_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  channel TEXT NOT NULL,
  display TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT NOT NULL,
  activity TEXT NOT NULL,
  activity_detail TEXT NOT NULL DEFAULT '',
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  v2v_ms INTEGER,
  barge_ins INTEGER NOT NULL DEFAULT 0,
  outcome TEXT,
  sentiment TEXT,
  metadata_json TEXT,
  model_provider TEXT,
  model_name TEXT,
  model_credential_id TEXT
);

CREATE TABLE IF NOT EXISTS call_turns (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  at_ms INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  tool TEXT,
  v2v_ms INTEGER,
  stt_ms INTEGER,
  llm_ms INTEGER,
  tts_ms INTEGER,
  model TEXT
);

CREATE TABLE IF NOT EXISTS session_tokens (
  token_hash TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS voices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en-IN',
  family_hint TEXT NOT NULL DEFAULT 'any',
  rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  pitch DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  note TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_snippets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  scope_all INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_scopes (
  snippet_id TEXT NOT NULL REFERENCES knowledge_snippets(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (snippet_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_tools (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS number_intents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'did_inbound',
  agent_id TEXT,
  region TEXT NOT NULL DEFAULT 'IN-SOUTH',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  utterance TEXT NOT NULL,
  assertion_kind TEXT NOT NULL DEFAULT 'contains',
  assertion_value TEXT NOT NULL DEFAULT '',
  max_ms INTEGER,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_version INTEGER NOT NULL DEFAULT 1,
  started_at BIGINT NOT NULL,
  finished_at BIGINT,
  passed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  p95_ms INTEGER
);

-- seq replaces the SQLite rowid the results table used to be ordered by. There
-- is no implicit row order in Postgres, and a run reads back in the order the
-- cases ran or the regression diff on /evals lines up against the wrong case.
CREATE TABLE IF NOT EXISTS eval_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 0,
  case_id TEXT NOT NULL,
  case_name TEXT NOT NULL,
  utterance TEXT NOT NULL,
  assertion TEXT NOT NULL,
  reply TEXT NOT NULL DEFAULT '',
  turn_ms INTEGER,
  pass INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS agent_policies (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  disclosure TEXT NOT NULL DEFAULT '',
  retention_days INTEGER NOT NULL DEFAULT 30,
  redact_pii INTEGER NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_tenant_status ON calls(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_ended ON calls(tenant_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_turns_call ON call_turns(call_id, seq);
CREATE INDEX IF NOT EXISTS idx_credentials_tenant ON provider_credentials(tenant_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_voices_tenant ON voices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_snippets_tenant ON knowledge_snippets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tools_tenant ON agent_tools(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intents_tenant ON number_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eval_cases_agent ON eval_cases(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_agent ON eval_runs(tenant_id, agent_id, started_at);
CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_results(run_id, seq);

-- Columns added after a database was already in use go here, one idempotent
-- ALTER each, and stay for good. Postgres ignores the statement when the column
-- is already there, so a fresh database runs them as no-ops.

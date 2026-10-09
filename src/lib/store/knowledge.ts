import 'server-only'

import { getDb, now, row, rows } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { KnowledgeSnippetRow, ToolKind, ToolRow } from '@/lib/store/types'

/*
 * The whole history goes to the model on every turn, so grounding text is not
 * free. PROMPT_CEILING is the budget the /knowledge screen reports against and
 * the hard cut resolveSystemPrompt applies, in that order: a snippet that would
 * push the prompt past the ceiling is dropped rather than truncated mid-sentence.
 */
export const PROMPT_CEILING = 4000

export interface SnippetWithScope extends KnowledgeSnippetRow {
  agentIds: string[]
}

export function listSnippets(tenantId: string): SnippetWithScope[] {
  const db = getDb()
  const snippets = rows<KnowledgeSnippetRow>(
    db
      .prepare('SELECT * FROM knowledge_snippets WHERE tenant_id = ? ORDER BY created_at ASC')
      .all(tenantId),
  )
  const scopes = db
    .prepare(
      `SELECT s.snippet_id, s.agent_id FROM knowledge_scopes s
       JOIN knowledge_snippets k ON k.id = s.snippet_id
       WHERE k.tenant_id = ?`,
    )
    .all(tenantId) as { snippet_id: string; agent_id: string }[]
  return snippets.map((snippet) => ({
    ...snippet,
    agentIds: scopes.filter((s) => s.snippet_id === snippet.id).map((s) => s.agent_id),
  }))
}

export function getSnippet(tenantId: string, snippetId: string): KnowledgeSnippetRow | undefined {
  return row<KnowledgeSnippetRow>(
    getDb()
      .prepare('SELECT * FROM knowledge_snippets WHERE id = ? AND tenant_id = ?')
      .get(snippetId, tenantId),
  )
}

export function createSnippet(
  tenantId: string,
  input: { name: string; body: string; scopeAll?: boolean; agentIds?: string[] },
): KnowledgeSnippetRow {
  const db = getDb()
  const created = now()
  const snippet: KnowledgeSnippetRow = {
    id: id('kns'),
    tenant_id: tenantId,
    name: input.name.trim(),
    body: input.body.trim(),
    scope_all: input.scopeAll ? 1 : 0,
    created_at: created,
    updated_at: created,
  }
  db.prepare(
    `INSERT INTO knowledge_snippets (id, tenant_id, name, body, scope_all, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    snippet.id,
    snippet.tenant_id,
    snippet.name,
    snippet.body,
    snippet.scope_all,
    snippet.created_at,
    snippet.updated_at,
  )
  setSnippetScope(tenantId, snippet.id, input.agentIds ?? [])
  return snippet
}

export function updateSnippet(
  tenantId: string,
  snippetId: string,
  input: { name?: string; body?: string; scopeAll?: boolean; agentIds?: string[] },
): void {
  const existing = getSnippet(tenantId, snippetId)
  if (!existing) return
  getDb()
    .prepare(
      `UPDATE knowledge_snippets SET name = ?, body = ?, scope_all = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      input.name?.trim() || existing.name,
      input.body?.trim() ?? existing.body,
      input.scopeAll === undefined ? existing.scope_all : input.scopeAll ? 1 : 0,
      now(),
      snippetId,
      tenantId,
    )
  if (input.agentIds) setSnippetScope(tenantId, snippetId, input.agentIds)
}

export function deleteSnippet(tenantId: string, snippetId: string): void {
  getDb()
    .prepare('DELETE FROM knowledge_snippets WHERE id = ? AND tenant_id = ?')
    .run(snippetId, tenantId)
}

function setSnippetScope(tenantId: string, snippetId: string, agentIds: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM knowledge_scopes WHERE snippet_id = ?').run(snippetId)
  const insert = db.prepare(
    'INSERT OR IGNORE INTO knowledge_scopes (snippet_id, agent_id) VALUES (?, ?)',
  )
  for (const agentId of agentIds) {
    const owned = db
      .prepare('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?')
      .get(agentId, tenantId)
    if (owned) insert.run(snippetId, agentId)
  }
}

export interface ToolWithScope extends ToolRow {
  agentIds: string[]
}

export function listTools(tenantId: string): ToolWithScope[] {
  const db = getDb()
  const tools = rows<ToolRow>(
    db.prepare('SELECT * FROM agent_tools WHERE tenant_id = ? ORDER BY created_at ASC').all(tenantId),
  )
  const scopes = db
    .prepare(
      `SELECT s.tool_id, s.agent_id FROM tool_scopes s
       JOIN agent_tools t ON t.id = s.tool_id
       WHERE t.tenant_id = ?`,
    )
    .all(tenantId) as { tool_id: string; agent_id: string }[]
  return tools.map((tool) => ({
    ...tool,
    agentIds: scopes.filter((s) => s.tool_id === tool.id).map((s) => s.agent_id),
  }))
}

/**
 * The tools one agent may call: the tenant-wide ones plus the ones scoped to it.
 * The runtime sends exactly this, so a tool narrowed to one agent cannot reach
 * another agent's turn.
 */
export function listToolsForAgent(tenantId: string, agentId: string): ToolRow[] {
  return rows<ToolRow>(
    getDb()
      .prepare(
        `SELECT t.* FROM agent_tools t
         WHERE t.tenant_id = ?
           AND (t.scope_all = 1 OR EXISTS (
             SELECT 1 FROM tool_scopes s WHERE s.tool_id = t.id AND s.agent_id = ?
           ))
         ORDER BY t.created_at ASC`,
      )
      .all(tenantId, agentId),
  )
}

export interface ToolInput {
  name: string
  description: string
  params?: string
  kind?: ToolKind
  connectorId?: string | null
  remoteName?: string
  scopeAll?: boolean
  agentIds?: string[]
}

export function createTool(tenantId: string, input: ToolInput): ToolRow {
  const created = now()
  const tool: ToolRow = {
    id: id('tol'),
    tenant_id: tenantId,
    name: input.name.trim(),
    description: input.description.trim(),
    params_json: normaliseParams(input.params),
    kind: input.kind ?? 'client',
    connector_id: input.connectorId ?? null,
    remote_name: input.remoteName?.trim() ?? '',
    scope_all: input.scopeAll ? 1 : 0,
    created_at: created,
    updated_at: created,
  }
  getDb()
    .prepare(
      `INSERT INTO agent_tools (
        id, tenant_id, name, description, params_json, kind, connector_id, remote_name,
        scope_all, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tool.id,
      tool.tenant_id,
      tool.name,
      tool.description,
      tool.params_json,
      tool.kind,
      tool.connector_id,
      tool.remote_name,
      tool.scope_all,
      tool.created_at,
      tool.updated_at,
    )
  setToolScope(tenantId, tool.id, input.agentIds ?? [])
  return tool
}

export function updateTool(
  tenantId: string,
  toolId: string,
  input: { description?: string; params?: string; scopeAll?: boolean; agentIds?: string[] },
): void {
  const existing = row<ToolRow>(
    getDb().prepare('SELECT * FROM agent_tools WHERE id = ? AND tenant_id = ?').get(toolId, tenantId),
  )
  if (!existing) return
  getDb()
    .prepare(
      `UPDATE agent_tools SET description = ?, params_json = ?, scope_all = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .run(
      input.description?.trim() ?? existing.description,
      input.params === undefined ? existing.params_json : normaliseParams(input.params),
      input.scopeAll === undefined ? existing.scope_all : input.scopeAll ? 1 : 0,
      now(),
      toolId,
      tenantId,
    )
  if (input.agentIds) setToolScope(tenantId, toolId, input.agentIds)
}

export function deleteTool(tenantId: string, toolId: string): void {
  getDb().prepare('DELETE FROM agent_tools WHERE id = ? AND tenant_id = ?').run(toolId, tenantId)
}

function setToolScope(tenantId: string, toolId: string, agentIds: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM tool_scopes WHERE tool_id = ?').run(toolId)
  const insert = db.prepare('INSERT OR IGNORE INTO tool_scopes (tool_id, agent_id) VALUES (?, ?)')
  for (const agentId of agentIds) {
    // An agent id off a form is user input, so ownership is checked rather than
    // trusted, exactly as knowledge scopes do it.
    const owned = db.prepare('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?').get(agentId, tenantId)
    if (owned) insert.run(toolId, agentId)
  }
}

/**
 * Replaces the imported tool rows for one connector. Scope carries across on the
 * remote name, so re-syncing does not silently widen a tool the operator had
 * narrowed. A newly imported tool reaches no agent until someone says so.
 */
export function replaceConnectorTools(
  tenantId: string,
  connectorId: string,
  remote: { name: string; description: string; inputSchema: Record<string, unknown> }[],
): number {
  const db = getDb()
  const previous = listTools(tenantId).filter((tool) => tool.connector_id === connectorId)
  db.prepare('DELETE FROM agent_tools WHERE tenant_id = ? AND connector_id = ?').run(
    tenantId,
    connectorId,
  )
  for (const tool of remote) {
    const before = previous.find((old) => old.remote_name === tool.name)
    createTool(tenantId, {
      name: toolNameFor(tool.name),
      description: tool.description,
      params: JSON.stringify(tool.inputSchema),
      kind: 'connector',
      connectorId,
      remoteName: tool.name,
      scopeAll: before ? before.scope_all === 1 : false,
      agentIds: before?.agentIds ?? [],
    })
  }
  return remote.length
}

/** Providers accept `^[a-zA-Z0-9_-]{1,64}$` for a function name; MCP is looser. */
function toolNameFor(remoteName: string): string {
  return remoteName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'tool'
}

/** Turns where the model asked for a tool. Reads the existing call_turns.tool. */
export function countToolIntents(tenantId: string, days = 7): number {
  const since = now() - days * 24 * 60 * 60 * 1000
  const found = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM call_turns t
       JOIN calls c ON c.id = t.call_id
       WHERE c.tenant_id = ? AND t.tool IS NOT NULL AND c.started_at >= ?`,
    )
    .get(tenantId, since) as { n: number }
  return Number(found.n) || 0
}

/** A bad params object must not take the turn down, so it degrades to no params. */
function normaliseParams(raw: string | undefined): string {
  if (!raw?.trim()) return '{"type":"object","properties":{}}'
  try {
    return JSON.stringify(JSON.parse(raw))
  } catch {
    return '{"type":"object","properties":{}}'
  }
}

export interface ResolvedPrompt {
  system: string
  snippetNames: string[]
  /** Scoped to this agent, and already in the order the request will send them. */
  tools: ToolRow[]
  toolNames: string[]
  chars: number
  dropped: string[]
}

/*
 * The one place the runtime prompt is composed. /knowledge renders the result of
 * this function rather than describing it, so the screen cannot drift from what
 * the turn actually sends.
 */
export function resolveSystemPrompt(
  tenantId: string,
  agentId: string,
  basePrompt: string,
): ResolvedPrompt {
  const snippets = listSnippets(tenantId).filter(
    (snippet) => snippet.scope_all === 1 || snippet.agentIds.includes(agentId),
  )
  const tools = listToolsForAgent(tenantId, agentId)

  const kept: SnippetWithScope[] = []
  const dropped: string[] = []
  let used = basePrompt.length
  for (const snippet of snippets) {
    const cost = snippet.name.length + snippet.body.length + 16
    if (used + cost > PROMPT_CEILING) {
      dropped.push(snippet.name)
      continue
    }
    used += cost
    kept.push(snippet)
  }

  // Tools are declared in the request body, not described in the prompt. Listing
  // them here as well would spend the ceiling twice and teach the model to name a
  // tool in prose instead of calling it.
  const blocks = kept.map((snippet) => `[knowledge: ${snippet.name}]\n${snippet.body}`)
  const system = [...blocks, basePrompt].join('\n\n')
  return {
    system,
    snippetNames: kept.map((snippet) => snippet.name),
    tools,
    toolNames: tools.map((tool) => tool.name),
    chars: system.length,
    dropped,
  }
}

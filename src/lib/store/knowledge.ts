import 'server-only'

import { all, now, one, run } from '@/lib/db'
import { id } from '@/lib/db/ids'
import type { KnowledgeSnippetRow, ToolRow } from '@/lib/store/types'

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

export async function listSnippets(tenantId: string): Promise<SnippetWithScope[]> {
  const [snippets, scopes] = await Promise.all([
    all<KnowledgeSnippetRow>(
      'SELECT * FROM knowledge_snippets WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    ),
    all<{ snippet_id: string; agent_id: string }>(
      `SELECT s.snippet_id, s.agent_id FROM knowledge_scopes s
       JOIN knowledge_snippets k ON k.id = s.snippet_id
       WHERE k.tenant_id = ?`,
      [tenantId],
    ),
  ])
  return snippets.map((snippet) => ({
    ...snippet,
    agentIds: scopes.filter((s) => s.snippet_id === snippet.id).map((s) => s.agent_id),
  }))
}

export function getSnippet(
  tenantId: string,
  snippetId: string,
): Promise<KnowledgeSnippetRow | undefined> {
  return one<KnowledgeSnippetRow>('SELECT * FROM knowledge_snippets WHERE id = ? AND tenant_id = ?', [
    snippetId,
    tenantId,
  ])
}

export async function createSnippet(
  tenantId: string,
  input: { name: string; body: string; scopeAll?: boolean; agentIds?: string[] },
): Promise<KnowledgeSnippetRow> {
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
  await run(
    `INSERT INTO knowledge_snippets (id, tenant_id, name, body, scope_all, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      snippet.id,
      snippet.tenant_id,
      snippet.name,
      snippet.body,
      snippet.scope_all,
      snippet.created_at,
      snippet.updated_at,
    ],
  )
  await setSnippetScope(tenantId, snippet.id, input.agentIds ?? [])
  return snippet
}

export async function updateSnippet(
  tenantId: string,
  snippetId: string,
  input: { name?: string; body?: string; scopeAll?: boolean; agentIds?: string[] },
): Promise<void> {
  const existing = await getSnippet(tenantId, snippetId)
  if (!existing) return
  await run(
    `UPDATE knowledge_snippets SET name = ?, body = ?, scope_all = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      input.name?.trim() || existing.name,
      input.body?.trim() ?? existing.body,
      input.scopeAll === undefined ? existing.scope_all : input.scopeAll ? 1 : 0,
      now(),
      snippetId,
      tenantId,
    ],
  )
  if (input.agentIds) await setSnippetScope(tenantId, snippetId, input.agentIds)
}

export async function deleteSnippet(tenantId: string, snippetId: string): Promise<void> {
  await run('DELETE FROM knowledge_snippets WHERE id = ? AND tenant_id = ?', [snippetId, tenantId])
}

async function setSnippetScope(
  tenantId: string,
  snippetId: string,
  agentIds: string[],
): Promise<void> {
  await run('DELETE FROM knowledge_scopes WHERE snippet_id = ?', [snippetId])
  for (const agentId of agentIds) {
    const owned = await one('SELECT 1 FROM agents WHERE id = ? AND tenant_id = ?', [
      agentId,
      tenantId,
    ])
    if (!owned) continue
    await run(
      'INSERT INTO knowledge_scopes (snippet_id, agent_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [snippetId, agentId],
    )
  }
}

export function listTools(tenantId: string): Promise<ToolRow[]> {
  return all<ToolRow>('SELECT * FROM agent_tools WHERE tenant_id = ? ORDER BY created_at ASC', [
    tenantId,
  ])
}

export async function createTool(
  tenantId: string,
  input: { name: string; description: string; params?: string },
): Promise<ToolRow> {
  const created = now()
  const tool: ToolRow = {
    id: id('tol'),
    tenant_id: tenantId,
    name: input.name.trim(),
    description: input.description.trim(),
    params_json: normaliseParams(input.params),
    created_at: created,
    updated_at: created,
  }
  await run(
    `INSERT INTO agent_tools (id, tenant_id, name, description, params_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tool.id,
      tool.tenant_id,
      tool.name,
      tool.description,
      tool.params_json,
      tool.created_at,
      tool.updated_at,
    ],
  )
  return tool
}

export async function deleteTool(tenantId: string, toolId: string): Promise<void> {
  await run('DELETE FROM agent_tools WHERE id = ? AND tenant_id = ?', [toolId, tenantId])
}

/** Turns where the model asked for a tool. Reads the existing call_turns.tool. */
export async function countToolIntents(tenantId: string, days = 7): Promise<number> {
  const since = now() - days * 24 * 60 * 60 * 1000
  const found = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM call_turns t
     JOIN calls c ON c.id = t.call_id
     WHERE c.tenant_id = ? AND t.tool IS NOT NULL AND c.started_at >= ?`,
    [tenantId, since],
  )
  return Number(found?.n) || 0
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
  toolNames: string[]
  chars: number
  dropped: string[]
}

/*
 * The one place the runtime prompt is composed. /knowledge renders the result of
 * this function rather than describing it, so the screen cannot drift from what
 * the turn actually sends.
 */
export async function resolveSystemPrompt(
  tenantId: string,
  agentId: string,
  basePrompt: string,
): Promise<ResolvedPrompt> {
  const [allSnippets, tools] = await Promise.all([listSnippets(tenantId), listTools(tenantId)])
  const snippets = allSnippets.filter(
    (snippet) => snippet.scope_all === 1 || snippet.agentIds.includes(agentId),
  )
  const toolNames = tools.map((tool) => tool.name)

  const kept: SnippetWithScope[] = []
  const dropped: string[] = []
  let used = basePrompt.length + (toolNames.length ? toolNames.join(', ').length + 10 : 0)
  for (const snippet of snippets) {
    const cost = snippet.name.length + snippet.body.length + 16
    if (used + cost > PROMPT_CEILING) {
      dropped.push(snippet.name)
      continue
    }
    used += cost
    kept.push(snippet)
  }

  const blocks = kept.map((snippet) => `[knowledge: ${snippet.name}]\n${snippet.body}`)
  if (toolNames.length) {
    blocks.push(
      `[tools] You may request one of these: ${toolNames.join(', ')}. Ask for a tool by name only when it is needed.`,
    )
  }
  const system = [...blocks, basePrompt].join('\n\n')
  return {
    system,
    snippetNames: kept.map((snippet) => snippet.name),
    toolNames,
    chars: system.length,
    dropped,
  }
}

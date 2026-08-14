'use client'

import { useActionState, useState } from 'react'
import { Button, Chip, Eyebrow, Input, Meter, TextArea } from '@/components/ui/primitives'
import {
  createSnippetAction,
  createToolAction,
  deleteSnippetAction,
  deleteToolAction,
  updateSnippetAction,
  type FormState,
} from '@/lib/store/actions'

export interface SnippetCard {
  id: string
  name: string
  body: string
  scopeAll: boolean
  agentIds: string[]
  chars: number
}

export interface ToolCard {
  id: string
  name: string
  description: string
  params: string
}

export interface KnowledgeAgent {
  id: string
  name: string
}

export interface PromptPreview {
  agentName: string
  snippetNames: string[]
  toolNames: string[]
  chars: number
  dropped: string[]
  system: string
}

const SNIPPET_GRID = 'grid grid-cols-[1.7fr_1.3fr_0.6fr_2.2fr_150px] gap-[13px]'

export function KnowledgeManager({
  snippets,
  tools,
  agents,
  preview,
  ceiling,
  toolIntents7d,
}: {
  snippets: SnippetCard[]
  tools: ToolCard[]
  agents: KnowledgeAgent[]
  preview: PromptPreview | null
  ceiling: number
  toolIntents7d: number
}) {
  const [tab, setTab] = useState<'knowledge' | 'tools'>('knowledge')
  const injected = preview?.chars ?? 0
  const bound = snippets.filter((snippet) => snippet.scopeAll || snippet.agentIds.length > 0).length

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
          <Eyebrow>RESOLVED PROMPT</Eyebrow>
          <div className="mt-[9px] flex items-baseline gap-[5px]">
            <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
              {injected.toLocaleString('en-US')}
            </span>
            <span className="font-sans text-[12px] leading-none font-medium text-muted">chars</span>
          </div>
          <div className="mt-[11px]">
            <Meter
              pct={(injected / ceiling) * 100}
              color={injected > ceiling * 0.9 ? 'var(--color-accent)' : 'var(--color-good)'}
              track="#efe9e1"
              targetPct={100}
            />
          </div>
          <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
            {Math.round((injected / ceiling) * 100)} percent of the {ceiling.toLocaleString('en-US')}{' '}
            char ceiling
          </div>
        </div>

        <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
          <Eyebrow>SNIPPETS IN SCOPE</Eyebrow>
          <div className="mt-[9px] flex items-baseline gap-[5px]">
            <span className="font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
              {bound}
            </span>
            <span className="font-sans text-[12px] leading-none font-medium text-muted">
              of {snippets.length}
            </span>
          </div>
          <div className="mt-[7px] font-sans text-[11px] leading-none text-muted-2">
            {snippets.length - bound === 0
              ? 'Every snippet reaches an agent'
              : `${snippets.length - bound} never reach an agent`}
          </div>
        </div>

        <div className="rounded-[9px] border border-line bg-panel p-[14px_15px]">
          <Eyebrow>TOOL INTENTS 7D</Eyebrow>
          <div className="mt-[9px] font-sans text-[25px] leading-none font-semibold tracking-[-0.5px] text-ink">
            {toolIntents7d.toLocaleString('en-US')}
          </div>
          <div className="mt-[7px] font-sans text-[11px] leading-[1.4] text-muted-2">
            Recorded on the turn. The client runs the tool, the control plane never does.
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(['knowledge', 'tools'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-[11px] py-[7px] font-sans text-[12px] font-semibold transition-colors ${
              tab === key
                ? 'border-accent text-ink'
                : 'border-transparent text-muted-2 hover:text-ink-3'
            }`}
          >
            {key === 'knowledge' ? `Knowledge (${snippets.length})` : `Tools (${tools.length})`}
          </button>
        ))}
      </div>

      {tab === 'knowledge' ? (
        <KnowledgeTab snippets={snippets} agents={agents} />
      ) : (
        <ToolsTab tools={tools} />
      )}

      {preview ? <PromptPanel preview={preview} /> : null}
    </div>
  )
}

function KnowledgeTab({
  snippets,
  agents,
}: {
  snippets: SnippetCard[]
  agents: KnowledgeAgent[]
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setOpen((was) => !was)}>
          {open ? 'Cancel' : 'New snippet'}
        </Button>
      </div>

      {open ? <SnippetForm agents={agents} onDone={() => setOpen(false)} /> : null}

      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        <div
          className={`${SNIPPET_GRID} border-b border-line-3 bg-panel-2 px-4 py-[10px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.07em] text-muted-4`}
        >
          <div>SNIPPET</div>
          <div>SCOPE</div>
          <div className="text-right">CHARS</div>
          <div>FIRST LINE</div>
          <div />
        </div>

        {snippets.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-sans text-[13px] text-ink-3">No grounding text yet.</p>
            <p className="mt-2 font-sans text-[12px] text-muted">
              A snippet goes into the system prompt ahead of the agent instruction, so the agent
              answers from your facts instead of guessing.
            </p>
          </div>
        ) : (
          snippets.map((snippet, i) => {
            const inScope = snippet.scopeAll || snippet.agentIds.length > 0
            return (
              <div
                key={snippet.id}
                className={i < snippets.length - 1 ? 'border-b border-line-4' : ''}
              >
                <div className={`${SNIPPET_GRID} items-center px-4 py-[12px]`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-[6px] w-[6px] rounded-full ${inScope ? 'bg-good' : 'bg-faint-3'}`}
                      />
                      <span className="font-sans text-[13px] leading-[1.2] font-semibold text-ink">
                        {snippet.name}
                      </span>
                      {inScope ? null : <Chip tone="accent">never injected</Chip>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {snippet.scopeAll ? (
                      <Chip tone="outline">all agents</Chip>
                    ) : snippet.agentIds.length === 0 ? (
                      <Chip tone="outline">no agent</Chip>
                    ) : (
                      snippet.agentIds.map((agentId) => (
                        <Chip key={agentId}>
                          {agents.find((agent) => agent.id === agentId)?.name ?? 'agent'}
                        </Chip>
                      ))
                    )}
                  </div>
                  <div
                    className={`text-right font-mono text-[12.5px] leading-none ${
                      inScope ? 'font-medium text-ink-2' : 'text-muted-3'
                    }`}
                  >
                    {snippet.chars.toLocaleString('en-US')}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted">
                    {snippet.body.split('\n')[0]}
                  </div>
                  <div className="flex justify-end gap-[6px]">
                    <Button
                      className="px-[9px] py-[6px] text-[11px]"
                      onClick={() => setEditing(editing === snippet.id ? null : snippet.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      className="px-[9px] py-[6px] text-[11px]"
                      onClick={() => deleteSnippetAction(snippet.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {editing === snippet.id ? (
                  <div className="border-t border-line-4 bg-panel-2 px-4 py-[14px]">
                    <SnippetForm
                      snippet={snippet}
                      agents={agents}
                      onDone={() => setEditing(null)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function SnippetForm({
  snippet,
  agents,
  onDone,
}: {
  snippet?: SnippetCard
  agents: KnowledgeAgent[]
  onDone: () => void
}) {
  const action = snippet ? updateSnippetAction : createSnippetAction
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined)
  const [scopeAll, setScopeAll] = useState(snippet?.scopeAll ?? false)

  return (
    <form
      action={async (form) => {
        await formAction(form)
        onDone()
      }}
      className="rounded-[9px] border border-line bg-panel p-[14px_15px]"
    >
      {snippet ? <input type="hidden" name="snippetId" value={snippet.id} /> : null}
      <Input label="Name" name="name" defaultValue={snippet?.name} placeholder="Refund policy" />
      <div className="mt-3">
        <TextArea
          label="Grounding text"
          name="body"
          rows={4}
          defaultValue={snippet?.body}
          placeholder="Refunds reach the source card in 5 to 7 working days."
        />
      </div>

      <div className="mt-3 border-t border-line-3 pt-3">
        <Eyebrow>SCOPE</Eyebrow>
        <div className="mt-[8px] flex flex-col gap-2">
          <label className="flex items-center gap-[7px] font-sans text-[12px] text-ink-2">
            <input
              name="scopeAll"
              type="checkbox"
              checked={scopeAll}
              onChange={(event) => setScopeAll(event.target.checked)}
              className="h-[13px] w-[13px] accent-accent"
            />
            Every agent in this workspace
          </label>
          {!scopeAll ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {agents.length === 0 ? (
                <span className="font-sans text-[11.5px] text-muted-2">
                  No agents yet, so this snippet will not reach a turn.
                </span>
              ) : (
                agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-[7px] font-sans text-[12px] text-ink-2"
                  >
                    <input
                      name="agentIds"
                      type="checkbox"
                      value={agent.id}
                      defaultChecked={snippet?.agentIds.includes(agent.id)}
                      className="h-[13px] w-[13px] accent-accent"
                    />
                    {agent.name}
                  </label>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>

      {state?.error ? (
        <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving' : snippet ? 'Save snippet' : 'Create snippet'}
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

function ToolsTab({ tools }: { tools: ToolCard[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createToolAction,
    undefined,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[9px] border border-line bg-panel-2 px-[13px] py-[11px]">
        <div className="font-sans text-[12px] font-semibold text-ink">
          Declared, not executed by us.
        </div>
        <p className="mt-[4px] font-sans text-[11.5px] leading-[1.45] text-muted">
          The model receives this list and can ask for one by name. We record the request on the
          turn and hand it back to your client, which holds its own credentials and does the work.
          The control plane never calls your endpoint during a turn.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => setOpen((was) => !was)}>
          {open ? 'Cancel' : 'New tool'}
        </Button>
      </div>

      {open ? (
        <form
          action={async (form) => {
            await formAction(form)
            setOpen(false)
          }}
          className="rounded-[9px] border border-line bg-panel p-[14px_15px]"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label="Function name" name="name" placeholder="lookup_order" />
            <Input label="Description" name="description" placeholder="Find an order by its id" />
          </div>
          <div className="mt-3">
            <TextArea
              label="Parameters (JSON schema)"
              name="params"
              rows={3}
              placeholder='{"type":"object","properties":{"orderId":{"type":"string"}}}'
            />
          </div>
          {state?.error ? (
            <p className="mt-2 font-sans text-[11.5px] text-accent-deep">{state.error}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving' : 'Create tool'}
            </Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        {tools.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="font-sans text-[13px] text-ink-3">No tools declared.</p>
            <p className="mt-2 font-sans text-[12px] text-muted">
              Declare one and the agent can ask for it by name during a turn.
            </p>
          </div>
        ) : (
          tools.map((tool, i) => (
            <div
              key={tool.id}
              className={`flex items-start justify-between gap-4 px-4 py-[12px] ${
                i < tools.length - 1 ? 'border-b border-line-4' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="font-mono text-[12.5px] font-semibold text-ink">{tool.name}</div>
                <div className="mt-1 font-sans text-[11.5px] text-muted-2">{tool.description}</div>
                <pre className="mt-2 overflow-x-auto rounded-[6px] border border-line-3 bg-panel-2 px-[9px] py-[7px] font-mono text-[10.5px] leading-[1.5] text-ink-3">
                  {tool.params}
                </pre>
              </div>
              <Button
                className="flex-none px-[9px] py-[6px] text-[11px]"
                onClick={() => deleteToolAction(tool.id)}
              >
                Delete
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/*
 * The exact string the next turn sends, rendered from the same resolver the
 * runtime calls. If this panel is wrong then the runtime is wrong too, which is
 * the point of showing it.
 */
function PromptPanel({ preview }: { preview: PromptPreview }) {
  return (
    <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>RESOLVED PROMPT / {preview.agentName.toUpperCase()}</Eyebrow>
        <span className="font-mono text-[10.5px] text-muted-2">
          {preview.snippetNames.length} snippet(s), {preview.toolNames.length} tool(s)
        </span>
      </div>
      {preview.dropped.length > 0 ? (
        <p className="mt-[8px] font-sans text-[11.5px] text-accent-deep">
          Over the ceiling, so these were dropped from the turn: {preview.dropped.join(', ')}
        </p>
      ) : null}
      <pre className="mt-[9px] max-h-[260px] overflow-auto rounded-[7px] border border-line-3 bg-panel-2 px-[11px] py-[9px] font-mono text-[11px] leading-[1.55] whitespace-pre-wrap text-ink-3">
        {preview.system}
      </pre>
    </div>
  )
}

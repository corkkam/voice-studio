import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { Eyebrow } from '@/components/ui/primitives'

interface Node {
  id?: string
  href?: string
  title: string
  body: string
  tone?: 'default' | 'active' | 'ops' | 'dashed' | 'accent'
}

const BUILD: Node[] = [
  {
    id: '1a',
    href: '/agents',
    title: 'Agents home',
    body: 'Entry point after login. Row click opens the builder; the live-count badge jumps to the monitor.',
  },
  {
    id: '1b',
    href: '/agents/loan-collections',
    title: 'Agent builder',
    body: 'Prompt, pipeline router, tools, turn taking. Test call runs in the right rail without leaving.',
    tone: 'active',
  },
]

const RUN_ENTRIES: Node[] = [
  {
    id: '1e',
    href: '/campaigns/collections-aug-w2',
    title: 'Outbound campaign',
    body: 'Compliance gate must pass before the dialer starts.',
  },
  { title: 'Inbound DID', body: 'Dispatch rule routes the number to an agent.' },
  {
    title: 'Interview link · meeting bot',
    body: 'WebRTC room instead of PSTN — same pipeline.',
  },
]

const RUN_DEPTHS: Node[] = [
  {
    id: '1c',
    href: '/calls',
    title: 'Live call monitor',
    body: 'Every in-flight call from all three entry points. Listen, whisper, take over.',
    tone: 'ops',
  },
  {
    id: '1d',
    href: '/calls/call_01K9ZQ4M',
    title: 'Call detail',
    body: 'Opened from a live card, the ended-calls strip, or a campaign row. Transcript + OTel spans.',
    tone: 'ops',
  },
]

const LEARN: Node[] = [
  {
    title: 'Eval set',
    body: '“Add to eval set” on any call detail. Failures become regression cases.',
  },
  {
    title: 'Evals',
    body: 'Simulated calls per version. Blocks publish if v2v or task success regresses.',
  },
]

const FOOTNOTES = [
  {
    title: 'ALWAYS ONE CLICK AWAY',
    body: 'Left nav (Build / Run / Trust), workspace + region switcher, and ⌘K search across agents, calls and numbers.',
  },
  {
    title: 'TRUST IS AMBIENT, NOT A PAGE',
    body: 'The compliance console exists, but its checks surface where the decision is made: the campaign gate, the disclosure line in the transcript, the retention block in call detail.',
  },
  {
    title: 'NOT YET DESIGNED',
    body: 'Voice library, Numbers & SIP, Evals, Keys & billing, and the interview module have nav slots and entry points but no screens yet.',
  },
]

export default function ArchitecturePage() {
  return (
    <>
      <TopBar />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 rounded-[10px] bg-[#f6f4f1] p-8">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-sans text-[17px] leading-[1.1] font-semibold tracking-[-0.2px] text-ink">
              Voice Studio · information architecture
            </h1>
            <p className="font-sans text-[12px] leading-[1.4] text-muted">
              Left nav is fixed on every screen: Build / Run / Trust. Everything else is drill-down.
            </p>
          </div>

          <Band title="BUILD">
            <div className="flex flex-wrap items-stretch gap-3">
              <NodeCard node={BUILD[0]} className="w-[236px] flex-none" />
              <Arrow />
              <NodeCard node={BUILD[1]} className="w-[236px] flex-none" />
              <Arrow />
              <div className="flex min-w-[280px] flex-1 flex-col justify-center gap-[7px] rounded-[9px] border border-dashed border-[#ddd7ce] bg-[#fbfaf8] px-[14px] py-[13px]">
                <Eyebrow>PULLED IN BY THE BUILDER</Eyebrow>
                <div className="flex flex-wrap gap-[6px]">
                  {[
                    'Voice library + cloning',
                    'Knowledge & tools',
                    'Numbers & SIP',
                    'Keys & billing (BYO)',
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-[5px] border border-line bg-panel px-[9px] py-[6px] font-sans text-[11px] leading-none font-medium text-ink-2"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="font-sans text-[11px] leading-[1.4] text-muted-2">
                  Each is a full page of its own, but reachable inline as a picker so configuration
                  never breaks flow.
                </p>
              </div>
            </div>
          </Band>

          <Band title="RUN">
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="flex w-[236px] flex-none flex-col gap-2">
                {RUN_ENTRIES.map((node) => (
                  <NodeCard key={node.title} node={node} compact />
                ))}
              </div>
              <Arrow />
              <NodeCard node={RUN_DEPTHS[0]} className="w-[236px] flex-none" />
              <Arrow />
              <NodeCard node={RUN_DEPTHS[1]} className="w-[236px] flex-none" />
              <div className="flex min-w-[260px] flex-1 flex-col justify-center gap-[6px] rounded-[9px] border border-dashed border-[#ddd7ce] bg-[#fbfaf8] px-[14px] py-[13px]">
                <Eyebrow>SAME OBJECT, THREE DEPTHS</Eyebrow>
                <p className="font-sans text-[11.5px] leading-[1.5] text-ink-3">
                  A call is a row in the campaign table, a card in the monitor, and a page in call
                  detail. The call id is the shared key, so any of the three can deep-link to the
                  others.
                </p>
              </div>
            </div>
          </Band>

          <Band title="LEARN">
            <div className="flex flex-wrap items-stretch gap-3">
              <NodeCard node={LEARN[0]} className="w-[236px] flex-none" />
              <Arrow />
              <NodeCard node={LEARN[1]} className="w-[236px] flex-none" />
              <Arrow accent />
              <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-[9px] border border-accent-line bg-accent-tint-2 px-[14px] py-[13px]">
                <div>
                  <div className="font-sans text-[12.5px] leading-[1.2] font-semibold text-accent-deep">
                    Back to the builder{' '}
                    <Link
                      href="/agents/loan-collections"
                      className="rounded-[5px] bg-[#f7e2d9] px-[7px] py-[3px] font-mono text-[10.5px] font-semibold text-accent-deep"
                    >
                      1b
                    </Link>
                  </div>
                  <p className="mt-[5px] font-sans text-[11.5px] leading-[1.45] text-muted">
                    The loop closes here: a bad turn in a real call becomes an eval case, which
                    fails a version, which sends you back to the pipeline router. Publish is the
                    only write that changes live traffic.
                  </p>
                </div>
              </div>
            </div>
          </Band>

          <div className="grid gap-[22px] border-t border-line-2 pt-[18px] md:grid-cols-3">
            {FOOTNOTES.map((note) => (
              <div key={note.title}>
                <Eyebrow>{note.title}</Eyebrow>
                <p className="mt-[7px] font-sans text-[11.5px] leading-[1.5] text-ink-3">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function Band({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-[10px]">
        <span className="font-mono text-[9.5px] leading-none font-semibold tracking-[0.08em] text-muted-4">
          {title}
        </span>
        <div className="h-px flex-1 bg-line-2" />
      </div>
      {children}
    </div>
  )
}

function Arrow({ accent = false }: { accent?: boolean }) {
  return (
    <div
      className={`hidden self-center font-mono text-[15px] leading-none font-medium lg:block ${
        accent ? 'text-accent' : 'text-faint'
      }`}
      aria-hidden
    >
      →
    </div>
  )
}

function NodeCard({
  node,
  className = '',
  compact = false,
}: {
  node: Node
  className?: string
  compact?: boolean
}) {
  const ops = node.tone === 'ops'
  const active = node.tone === 'active'

  const inner = (
    <>
      {node.id ? (
        <span
          className={`inline-block rounded-[5px] px-[7px] py-[3px] font-mono text-[10.5px] leading-none font-semibold ${
            ops
              ? 'bg-[#332c26] text-[#f4f1ec]'
              : active
                ? 'bg-accent-tint text-accent-deep'
                : 'bg-black/[.08] text-ink'
          }`}
        >
          {node.id}
        </span>
      ) : null}
      <div
        className={`font-sans leading-[1.2] font-semibold ${node.id && !compact ? 'mt-[9px]' : ''} ${
          compact ? 'text-[12.5px]' : 'text-[13px]'
        } ${ops ? 'text-white' : 'text-ink'}`}
      >
        {node.title}
      </div>
      <p
        className={`mt-[5px] font-sans leading-[1.45] ${compact ? 'text-[11px]' : 'text-[11.5px]'} ${
          ops ? 'text-faint' : 'text-muted'
        }`}
      >
        {node.body}
      </p>
    </>
  )

  const base = `rounded-[9px] px-[14px] py-[13px] transition-shadow ${
    ops
      ? 'border border-line bg-ink'
      : active
        ? 'border-[1.5px] border-accent bg-panel'
        : 'border border-line bg-panel'
  } ${node.href ? 'hover:shadow-[0_2px_10px_rgba(0,0,0,.1)]' : ''} ${className}`

  if (node.href) {
    return (
      <Link href={node.href} className={`block ${base}`}>
        {compact && node.id ? (
          <div className="flex items-baseline gap-2">
            <span className="rounded-[5px] bg-black/[.08] px-[7px] py-[3px] font-mono text-[10.5px] leading-none font-semibold text-ink">
              {node.id}
            </span>
            <span className="font-sans text-[12.5px] leading-[1.2] font-semibold text-ink">
              {node.title}
            </span>
          </div>
        ) : null}
        {compact && node.id ? (
          <p className="mt-[5px] font-sans text-[11px] leading-[1.4] text-muted">{node.body}</p>
        ) : (
          inner
        )}
      </Link>
    )
  }

  return <div className={base}>{inner}</div>
}

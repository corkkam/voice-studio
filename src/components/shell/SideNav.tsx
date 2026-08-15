'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFleet, utilColor } from '@/lib/fleet'
import { useLiveFeed } from '@/lib/runtime'

interface NavItem {
  label: string
  href?: string
  badge?: number
  /** Nav slots the IA reserves but no screen exists for yet. */
  pending?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const PAPER_NAV: NavGroup[] = [
  {
    title: 'BUILD',
    items: [
      { label: 'Agents', href: '/agents' },
      { label: 'Voices', href: '/voices' },
      { label: 'Knowledge and tools', href: '/knowledge' },
    ],
  },
  {
    title: 'RUN',
    items: [
      { label: 'Numbers and SIP', href: '/numbers' },
      { label: 'Campaigns', href: '/campaigns' },
      { label: 'Calls', href: '/calls' },
    ],
  },
  {
    title: 'TRUST',
    items: [
      { label: 'Evals', href: '/evals' },
      { label: 'Compliance', href: '/compliance' },
      { label: 'Keys', href: '/keys' },
    ],
  },
]

const OPS_NAV: NavItem[] = [
  { label: 'Agents', href: '/agents' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Live calls', href: '/calls' },
  { label: 'Keys', href: '/keys' },
  { label: 'Evals', href: '/evals' },
]

function Wordmark({ tone }: { tone: 'paper' | 'ops' }) {
  return (
    <Link href="/architecture" className="flex items-center gap-[9px] px-[6px] py-[2px]">
      <div className="h-4 w-4 flex-none rounded-[4px] bg-accent" />
      <div
        className={`font-sans text-[13.5px] leading-none font-bold tracking-[-0.2px] ${
          tone === 'ops' ? 'text-ops-ink' : 'text-ink'
        }`}
      >
        Voice Studio
      </div>
    </Link>
  )
}

function isActive(pathname: string, href?: string) {
  if (!href) return false
  if (href === '/agents') return pathname === '/agents' || pathname.startsWith('/agents/')
  if (href === '/calls') return pathname === '/calls'
  if (href.startsWith('/calls/')) return pathname.startsWith('/calls/')
  if (href.startsWith('/campaigns')) return pathname.startsWith('/campaigns')
  if (href === '/evals') return pathname === '/evals' || pathname.startsWith('/evals/')
  return pathname === href
}

/** Paper-surface nav — the studio's canonical Build / Run / Trust spine. */
export function PaperSideNav() {
  const pathname = usePathname()
  const { liveCount } = useLiveFeed()

  return (
    <nav className="flex w-[214px] flex-none flex-col gap-[18px] border-r border-line-2 bg-nav p-[14px_12px]">
      <Wordmark tone="paper" />

      <div className="flex flex-col gap-[2px]">
        {PAPER_NAV.map((group) => (
          <div key={group.title} className="contents">
            <div className="px-[9px] pt-[14px] pb-[6px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.08em] text-muted-4 first:pt-[6px]">
              {group.title}
            </div>
            {group.items.map((item) => {
              const badge = item.href === '/calls' ? liveCount : item.badge
              const active = isActive(pathname, item.href)
              const body = (
                <>
                  <span className="flex items-center gap-[9px]">
                    <span
                      className={`h-[5px] w-[5px] rounded-[1px] ${
                        active ? 'bg-accent' : 'bg-faint-2'
                      }`}
                    />
                    {item.label}
                  </span>
                  {badge ? (
                    <span className="flex items-center gap-[5px] font-mono text-[9.5px] leading-none font-semibold text-accent-deep">
                      <span className="h-[5px] w-[5px] rounded-full bg-accent" />
                      {badge.toLocaleString('en-US')}
                    </span>
                  ) : null}
                </>
              )

              const className = `flex items-center justify-between rounded-[6px] px-[9px] py-[7px] font-sans text-[12.5px] leading-none ${
                active
                  ? 'bg-panel font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.07)]'
                  : item.pending
                    ? 'font-medium text-faint-2'
                    : 'font-medium text-muted hover:bg-panel/60 hover:text-ink-2'
              }`

              return item.href ? (
                <Link key={item.label} href={item.href} className={className}>
                  {body}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className={className}
                  title="Nav slot reserved. No screen for it yet."
                >
                  {body}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-[8px] border border-line-2 bg-panel-2 p-[10px]">
        <div className="mb-[6px] font-mono text-[9.5px] leading-none font-semibold tracking-[0.06em] text-muted-4">
          SESSION PLANE
        </div>
        <div className="flex justify-between font-sans text-[11px] leading-[1.4] font-medium text-ink-3">
          <span>Web + macOS SDK</span>
          <span className="font-semibold text-good">up</span>
        </div>
        <div className="mt-[8px] font-mono text-[10.5px] leading-none font-medium text-muted-2">
          {liveCount} live session{liveCount === 1 ? '' : 's'}
        </div>
      </div>
    </nav>
  )
}

/** Ops-surface nav — condensed to what matters while calls are in flight. */
export function OpsSideNav() {
  const pathname = usePathname()
  const { active, capacity, util } = useFleet()
  const { liveCount, ended } = useLiveFeed()

  return (
    <nav className="flex w-[196px] flex-none flex-col gap-4 border-r border-ops-line bg-ops-nav p-[14px_12px]">
      <Wordmark tone="ops" />

      <div className="flex flex-col gap-[2px]">
        {OPS_NAV.map((item) => {
          const badge = item.href === '/calls' ? liveCount : item.badge
          const active = isActive(pathname, item.href)
          const className = `flex items-center justify-between rounded-[6px] px-[9px] py-[7px] font-sans text-[12.5px] leading-none ${
            active
              ? 'bg-ops-raised font-semibold text-ops-ink'
              : item.pending
                ? 'font-medium text-ops-faint-3'
                : 'font-medium text-ops-muted-2 hover:text-ops-ink-3'
          }`
          const body = (
            <>
              <span>{item.label}</span>
              {badge ? (
                <span className="flex items-center gap-[5px] font-mono text-[9.5px] leading-none font-semibold text-accent">
                  <span className="h-[5px] w-[5px] rounded-full bg-accent" />
                  {badge.toLocaleString('en-US')}
                </span>
              ) : null}
            </>
          )
          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {body}
            </Link>
          ) : (
            <div
              key={item.label}
              className={className}
              title="Nav slot reserved — screen not designed yet"
            >
              {body}
            </div>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col gap-[9px]">
        <div className="rounded-[8px] border border-ops-line bg-ops-panel-2 p-[10px]">
          <div className="font-mono text-[9.5px] leading-none font-semibold tracking-[0.06em] text-ops-muted-3">
            CONCURRENCY POOL
          </div>
          <div className="mt-[8px] font-mono text-[17px] leading-none font-semibold text-ops-ink">
            {active.toLocaleString('en-US')}
            <span className="text-[12px] text-ops-faint">/{capacity.toLocaleString('en-US')}</span>
          </div>
          <div className="mt-[8px] h-[4px] overflow-hidden rounded-[2px] bg-ops-line">
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${util}%`, background: utilColor(util) }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[6px] rounded-[8px] border border-ops-line bg-ops-panel-2 p-[10px]">
          {[
            { label: 'Live sessions', value: String(liveCount) },
            { label: 'Ended (retained)', value: String(ended.length) },
            { label: 'Dialer', value: 'off' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between gap-2 font-mono text-[10.5px] leading-none font-medium text-ops-muted-2"
            >
              <span className="truncate">{row.label}</span>
              <span className="flex-none text-ops-ink-3">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[6px] rounded-[8px] border border-ops-line bg-ops-panel-2 p-[10px]">
          {[
            { label: 'Session API', value: 'up', tone: 'good' as const },
            { label: 'Web + macOS SDK', value: 'ready', tone: 'good' as const },
            { label: 'PSTN carrier', value: 'not wired', tone: 'alert' as const },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between font-mono text-[10.5px] leading-none font-medium text-ops-muted-2"
            >
              <span>{row.label}</span>
              <span className={row.tone === 'good' ? 'text-ops-good' : 'text-accent'}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}

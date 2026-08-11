import Link from 'next/link'
import { WORKSPACE } from '@/lib/data/agents'

/** Workspace + region switcher, ⌘K, and the signed-in operator. */
export function TopBar() {
  return (
    <header className="flex h-[54px] flex-none items-center gap-[14px] border-b border-line bg-panel px-[22px]">
      <div className="flex items-center gap-2 rounded-[6px] border border-line-2 bg-[#f8f6f3] px-[10px] py-[6px]">
        <div className="h-[14px] w-[14px] rounded-[3px] bg-ink" />
        <span className="font-sans text-[12px] leading-none font-semibold text-ink">
          {WORKSPACE.tenant}
        </span>
        <span className="font-mono text-[10.5px] leading-none font-medium text-muted-3">
          {WORKSPACE.region}
        </span>
      </div>

      <div className="flex max-w-[300px] flex-1 justify-between rounded-[6px] border border-line px-[10px] py-[6px] font-sans text-[12px] leading-none text-[#a49b91]">
        <span>Search agents, calls, numbers</span>
        <span className="font-mono text-[10.5px] font-medium">⌘K</span>
      </div>

      <div className="ml-auto flex items-center gap-[10px]">
        <div className="font-sans text-[11.5px] leading-none font-medium text-muted">
          {WORKSPACE.date}
        </div>
        <div className="h-[26px] w-[26px] rounded-full border border-faint-3 bg-[#dcd4c9] text-center font-sans text-[10.5px] leading-[26px] font-semibold text-[#6b645d]">
          {WORKSPACE.initials}
        </div>
      </div>
    </header>
  )
}

export interface Crumb {
  label: string
  href?: string
}

/** Drill-down header used by the builder and campaign surfaces. */
export function CrumbBar({
  crumbs,
  badge,
  children,
}: {
  crumbs: Crumb[]
  badge?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex h-[54px] flex-none items-center gap-[12px] border-b border-line bg-panel px-[22px]">
      <div className="h-4 w-4 flex-none rounded-[4px] bg-accent" />
      <div className="font-sans text-[12px] leading-none font-medium text-muted-3">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label}>
            {i > 0 ? <span className="mx-[7px] text-faint-3">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-ink-2">
                {crumb.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'font-semibold text-ink' : undefined}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {badge}
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </header>
  )
}

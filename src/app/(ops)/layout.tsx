import { OpsSideNav } from '@/components/shell/SideNav'
import { FleetProvider } from '@/lib/fleet'

/**
 * Ops shell — the run surfaces, always dark regardless of OS preference.
 *
 * `data-theme="dark"` gives thinking-orbs its light ink, and sets
 * `color-scheme` so form chrome and scrollbars stop flashing white.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FleetProvider>
      <div data-theme="dark" className="flex h-screen bg-ops-bg">
        <OpsSideNav />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </FleetProvider>
  )
}

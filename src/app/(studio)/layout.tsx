import { PaperSideNav } from '@/components/shell/SideNav'

/**
 * Paper shell — the build surfaces.
 *
 * `data-theme="light"` is what thinking-orbs reads to pick its ink, so every
 * orb rendered under here comes out dark-on-paper without being told.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="flex h-screen bg-canvas">
      <PaperSideNav />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

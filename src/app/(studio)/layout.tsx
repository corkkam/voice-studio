import { PaperSideNav } from '@/components/shell/SideNav'
import { requireAuth } from '@/lib/auth/session'
import { RuntimeProvider } from '@/lib/runtime'
import { getSnapshot } from '@/lib/store/calls'
import { toWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth()
  return (
    <RuntimeProvider workspace={toWorkspace(auth)} initial={getSnapshot(auth.tenant.id)}>
      <div data-theme="light" className="flex h-screen bg-canvas">
        <PaperSideNav />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </RuntimeProvider>
  )
}

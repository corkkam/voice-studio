import { TopBar } from '@/components/shell/TopBar'
import { KeysManager } from '@/components/keys/KeysManager'
import { requireAuth } from '@/lib/auth/session'
import { listKeys } from '@/lib/store/keys'

export default async function KeysPage() {
  const auth = await requireAuth()
  const keys = listKeys(auth.tenant.id)

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">Keys</h1>
        <p className="mt-[6px] mb-6 max-w-[640px] font-sans text-[13px] text-muted">
          Secret keys authenticate Mac apps and servers. Publishable keys authenticate the web
          widget. Neither key ever carries audio — clients open a session, then stream events.
        </p>
        <KeysManager keys={keys} />
      </div>
    </>
  )
}

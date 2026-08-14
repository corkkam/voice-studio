import { TopBar } from '@/components/shell/TopBar'
import { VoicesManager } from '@/components/voices/VoicesManager'
import { requireAuth } from '@/lib/auth/session'
import { countAgentsByVoice, listAgentSummaries } from '@/lib/store/agents'
import { listVoices } from '@/lib/store/voices'

export default async function VoicesPage() {
  const auth = await requireAuth()
  const voices = listVoices(auth.tenant.id)
  const counts = countAgentsByVoice(auth.tenant.id)
  const agents = listAgentSummaries(auth.tenant.id)

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">Voices</h1>
        <p className="mt-[6px] mb-6 max-w-[680px] font-sans text-[13px] text-muted">
          Speech runs on the caller device, not on the control plane. A preset is a locale, a rate,
          a pitch and a family hint that the web widget and the macOS client each resolve against a
          real device voice. Preview plays in your own browser.
        </p>
        <VoicesManager
          voices={voices.map((voice) => ({
            id: voice.id,
            name: voice.name,
            locale: voice.locale,
            familyHint: voice.family_hint,
            rate: voice.rate,
            pitch: voice.pitch,
            note: voice.note,
            isDefault: voice.is_default === 1,
            agentCount: counts[voice.id] ?? 0,
          }))}
          agents={agents}
        />
      </div>
    </>
  )
}

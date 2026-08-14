import { TopBar } from '@/components/shell/TopBar'
import { NumberIntents } from '@/components/numbers/NumberIntents'
import { Eyebrow } from '@/components/ui/primitives'
import { requireAuth } from '@/lib/auth/session'
import { listAgentSummaries } from '@/lib/store/agents'
import { KIND_LABELS, listNumberIntents } from '@/lib/store/numbers'

/*
 * This screen exists so the nav slot is not a dead end, and it is deliberately
 * honest about being blocked. There is no carrier, no PSTN number and no media
 * plane in this product, so nothing here can answer a call. Never add a status
 * that implies otherwise, and never describe a row as dialled.
 */
const MISSING = [
  { title: 'Carrier or SIP account', detail: 'No provider is connected' },
  { title: 'Media plane', detail: 'No RTP path. Turn audio runs on the caller device' },
  { title: 'Server side STT and TTS', detail: 'Both run on the device today' },
]

const WORKING = [
  { title: 'Session API', detail: 'Web widget, JS SDK, macOS SDK' },
  { title: 'Live monitor', detail: 'SSE over an in-process hub' },
]

export default async function NumbersPage() {
  const auth = await requireAuth()
  const agents = listAgentSummaries(auth.tenant.id)
  const byId = new Map(agents.map((agent) => [agent.id, agent.name]))
  const intents = listNumberIntents(auth.tenant.id)

  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Numbers and SIP
        </h1>
        <p className="mt-[6px] mb-5 max-w-[680px] font-sans text-[13px] text-muted">
          Where telephony will attach. Nothing here carries audio yet.
        </p>

        <div className="mb-5 flex items-start gap-[10px] rounded-[9px] border border-accent-line bg-accent-tint px-[13px] py-[11px]">
          <span className="mt-px h-[14px] w-[14px] flex-none rounded-[4px] bg-accent" />
          <div>
            <div className="font-sans text-[12px] font-semibold text-ink">
              No media plane. No number can answer a call.
            </div>
            <p className="mt-[3px] max-w-[720px] font-sans text-[11.5px] leading-[1.45] text-muted">
              There is no carrier account, no SIP trunk and no audio path on the control plane. Voice
              turns run on the caller device over the session API. The rows below record what you
              intend to provision. Nothing is reachable from the telephone network.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <NumberIntents
            intents={intents.map((intent) => ({
              id: intent.id,
              name: intent.name,
              note: intent.note,
              kindLabel: KIND_LABELS[intent.kind] ?? intent.kind,
              agentName: intent.agent_id ? byId.get(intent.agent_id) ?? null : null,
              region: intent.region,
            }))}
            agents={agents.map((agent) => ({ id: agent.id, name: agent.name }))}
          />

          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
              <Eyebrow>WHAT IS MISSING</Eyebrow>
              <div className="mt-[10px] flex flex-col gap-2">
                {MISSING.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-[10px] rounded-[8px] border border-line-3 bg-panel px-[11px] py-[10px]"
                  >
                    <span className="mt-px h-[14px] w-[14px] flex-none rounded-[4px] bg-faint-3" />
                    <div>
                      <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
                        {item.title}
                      </div>
                      <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-[10px] rounded-[8px] border border-accent-line bg-accent-tint-2 px-[11px] py-[10px]">
                  <span className="mt-px h-[14px] w-[14px] flex-none rounded-[4px] bg-accent" />
                  <div>
                    <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
                      Shared datastore
                    </div>
                    <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">
                      SQLite is one process on one machine. It blocks any deploy first.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-line bg-panel p-[14px_15px]">
              <Eyebrow>WHAT WORKS TODAY</Eyebrow>
              <div className="mt-[10px] flex flex-col gap-2">
                {WORKING.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-[10px] rounded-[8px] border border-good-line bg-good-tint px-[11px] py-[10px]"
                  >
                    <span className="mt-px h-[14px] w-[14px] flex-none rounded-[4px] bg-good" />
                    <div>
                      <div className="font-sans text-[11.5px] leading-[1.3] font-semibold text-ink">
                        {item.title}
                      </div>
                      <div className="mt-[3px] font-mono text-[10.5px] leading-[1.4] text-muted">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

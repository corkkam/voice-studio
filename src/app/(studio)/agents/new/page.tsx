import { TopBar } from '@/components/shell/TopBar'
import { NewAgentForm } from '@/components/agents/NewAgentForm'

export default function NewAgentPage() {
  return (
    <>
      <TopBar />
      <div className="flex-1 overflow-y-auto px-[26px] py-[26px]">
        <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">New agent</h1>
        <p className="mt-[6px] mb-6 font-sans text-[13px] text-muted">
          Starts as a draft. Publish it before a public web or Mac client can open a session.
        </p>
        <NewAgentForm />
      </div>
    </>
  )
}

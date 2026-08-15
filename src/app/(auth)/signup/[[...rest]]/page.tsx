import { SignUp } from '@clerk/nextjs'
import { authAppearance } from '@/components/auth/appearance'

export default function SignupPage() {
  return (
    <div className="w-full max-w-[440px] rounded-[12px] border border-line bg-panel p-8 shadow-[0_8px_32px_rgba(0,0,0,.06)]">
      <div className="mb-6 flex items-center gap-[9px]">
        <div className="h-4 w-4 rounded-[4px] bg-accent" />
        <div className="font-sans text-[15px] font-bold tracking-[-0.2px] text-ink">Voice Studio</div>
      </div>
      <h1 className="font-sans text-[22px] font-semibold tracking-[-0.3px] text-ink">
        Create a workspace
      </h1>
      <p className="mt-[6px] mb-6 font-sans text-[13px] text-muted">
        One tenant, your agents, API keys for web and macOS clients.
      </p>
      <SignUp appearance={authAppearance} signInUrl="/login" fallbackRedirectUrl="/agents" />
    </div>
  )
}

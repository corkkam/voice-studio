import { SignUp } from '@clerk/nextjs'

/*
 * Signing up is all it takes to get a workspace: the tenant, the membership and
 * the defaults are provisioned on the first signed-in request, in
 * `src/lib/auth/session.ts`. No onboarding step, by design.
 */
export default function SignupPage() {
  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-6 flex items-center gap-[9px]">
        <div className="h-4 w-4 rounded-[4px] bg-accent" />
        <div className="font-sans text-[15px] font-bold tracking-[-0.2px] text-ink">Voice Studio</div>
      </div>
      <SignUp />
    </div>
  )
}

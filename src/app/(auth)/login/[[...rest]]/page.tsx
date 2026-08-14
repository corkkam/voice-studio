import { SignIn } from '@clerk/nextjs'

/*
 * Catch-all, because Clerk routes its own sub-steps (factor two, reset, SSO
 * callback) under this path. Kept at /login rather than Clerk's default
 * /sign-in so no existing link or redirect changes.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-6 flex items-center gap-[9px]">
        <div className="h-4 w-4 rounded-[4px] bg-accent" />
        <div className="font-sans text-[15px] font-bold tracking-[-0.2px] text-ink">Voice Studio</div>
      </div>
      <SignIn />
    </div>
  )
}

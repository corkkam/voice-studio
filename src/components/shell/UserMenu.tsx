'use client'

import { SignOutButton } from '@clerk/nextjs'
import { useWorkspace } from '@/lib/runtime'

export function UserMenu() {
  const workspace = useWorkspace()

  return (
    <div className="ml-auto flex items-center gap-[10px]">
      <div className="font-sans text-[11.5px] leading-none font-medium text-muted">{workspace.date}</div>
      <div
        className="h-[26px] w-[26px] rounded-full border border-faint-3 bg-[#dcd4c9] text-center font-sans text-[10.5px] leading-[26px] font-semibold text-[#6b645d]"
        title={workspace.email}
      >
        {workspace.initials}
      </div>
      <SignOutButton redirectUrl="/login">
        <button
          type="button"
          className="font-sans text-[11px] font-semibold text-muted hover:text-ink"
        >
          Sign out
        </button>
      </SignOutButton>
    </div>
  )
}

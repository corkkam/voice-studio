'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/auth/actions'
import { Button } from '@/components/ui/primitives'
import { Field } from '@/components/auth/LoginForm'

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined)

  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-4">
      <Field label="Your name" name="name" autoComplete="name" />
      <Field label="Work email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" />
      <Field label="Workspace" name="workspace" autoComplete="organization" />
      {state?.error ? (
        <p className="font-sans text-[12px] leading-none text-accent-deep">{state.error}</p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full py-[11px]">
        {pending ? 'Creating workspace…' : 'Create workspace'}
      </Button>
      <p className="text-center font-sans text-[12px] text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent-deep hover:text-accent">
          Sign in
        </Link>
      </p>
    </form>
  )
}

'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signIn } from '@/lib/auth/actions'
import { Button } from '@/components/ui/primitives'

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined)

  return (
    <form action={action} className="flex w-full max-w-[420px] flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      {state?.error ? (
        <p className="font-sans text-[12px] leading-none text-accent-deep">{state.error}</p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full py-[11px]">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center font-sans text-[12px] text-muted">
        No workspace yet?{' '}
        <Link href="/signup" className="font-semibold text-accent-deep hover:text-accent">
          Create one
        </Link>
      </p>
    </form>
  )
}

export function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  defaultValue,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  defaultValue?: string
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="font-mono text-[10px] font-semibold tracking-[0.07em] text-muted-4">
        {label.toUpperCase()}
      </span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="rounded-[7px] border border-line bg-panel px-3 py-[10px] font-sans text-[13px] text-ink outline-none focus:border-accent"
      />
    </label>
  )
}

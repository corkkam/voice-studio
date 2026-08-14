'use server'

import { redirect } from 'next/navigation'
import { createSession, destroySession, findUserByEmail, insertUser } from '@/lib/auth/session'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

export type AuthState = { error?: string } | undefined

function read(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim()
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = read(form, 'name')
  const email = read(form, 'email').toLowerCase()
  const password = String(form.get('password') ?? '')
  const workspace = read(form, 'workspace')

  if (name.length < 2) return { error: 'Name must be at least 2 characters.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (workspace.length < 2) return { error: 'Workspace name must be at least 2 characters.' }
  if (findUserByEmail(email)) return { error: 'An account with that email already exists.' }

  const { user } = insertUser({
    email,
    name,
    passwordHash: hashPassword(password),
    tenantName: workspace,
  })
  await createSession(user.id)
  redirect('/agents')
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = read(form, 'email').toLowerCase()
  const password = String(form.get('password') ?? '')
  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'Email or password is incorrect.' }
  }
  await createSession(user.id)
  redirect('/agents')
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/login')
}

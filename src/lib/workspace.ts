import type { AuthContext } from '@/lib/auth/session'
import type { Workspace } from '@/lib/runtime'

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'VS'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function toWorkspace(auth: AuthContext): Workspace {
  return {
    tenantId: auth.tenant.id,
    tenant: auth.tenant.name,
    region: auth.tenant.region,
    initials: initialsFrom(auth.user.name),
    userName: auth.user.name,
    email: auth.user.email,
    date: new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }
}

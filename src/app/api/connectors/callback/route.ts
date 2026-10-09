import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/session'
import { completeConnectorAuth } from '@/lib/connectors/service'

export const runtime = 'nodejs'

/*
 * Where the authorization server sends the operator back. This is an operator
 * surface, so it is deliberately absent from the public matcher in `src/proxy.ts`
 * and Clerk guards it: the tenant on the session is what the state row is checked
 * against, which is what stops one workspace redeeming another's code.
 */
export async function GET(req: Request) {
  const auth = await requireAuth()
  const url = new URL(req.url)
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (error) return back(`Connection refused: ${error}`)
  if (!code || !state) return back('That callback was missing its code.')

  try {
    await completeConnectorAuth({
      tenantId: auth.tenant.id,
      state,
      code,
      issuer: url.searchParams.get('iss') ?? undefined,
    })
  } catch (failed) {
    // The message is ours, not the provider's, and the detail stays server side.
    console.error('connector callback failed', failed)
    const message = failed instanceof Error ? failed.message : 'That connection failed.'
    return back(message)
  }
  return back()
}

function back(note?: string): never {
  redirect(note ? `/connectors?note=${encodeURIComponent(note)}` : '/connectors?connected=1')
}

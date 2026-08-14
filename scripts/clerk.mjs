/*
 * The Clerk Backend API, for the two scripts that need an operator identity
 * without a browser: `pnpm seed` creates the demo user, `pnpm session` mints a
 * session token so an agent can fetch a signed-in page with curl.
 *
 * CLERK_SECRET_KEY comes from .env.local, which package.json passes in with
 * --env-file-if-exists. Never print the key, and never print a session token
 * into anything that is kept.
 */

const API = 'https://api.clerk.com/v1'

function secretKey() {
  const key = process.env.CLERK_SECRET_KEY
  if (!key) {
    console.error(
      'CLERK_SECRET_KEY is not set. Pull the development keys first:\n' +
        '  clerk env pull --file .env.local',
    )
    process.exit(1)
  }
  return key
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    const detail = text.slice(0, 300)
    throw new Error(`Clerk ${init.method ?? 'GET'} ${path} failed: ${res.status} ${detail}`)
  }
  return text ? JSON.parse(text) : null
}

export async function clerkUserByEmail(email) {
  const users = await call(`/users?email_address=${encodeURIComponent(email)}&limit=1`)
  return Array.isArray(users) && users.length ? users[0] : null
}

export async function createClerkUser({ email, password, firstName, lastName }) {
  return call('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName,
      last_name: lastName || undefined,
      skip_password_checks: false,
    }),
  })
}

export async function createClerkSession(userId) {
  return call('/sessions', { method: 'POST', body: JSON.stringify({ user_id: userId }) })
}

export async function createSessionToken(sessionId, expiresInSeconds) {
  return call(`/sessions/${sessionId}/tokens`, {
    method: 'POST',
    body: JSON.stringify({ expires_in_seconds: expiresInSeconds }),
  })
}

/*
 * A development instance refuses any request that carries no dev browser
 * token, whatever the session says: the gate answers 307 with
 * x-clerk-auth-reason: dev-browser-missing. A browser gets this token from
 * clerk-js on first load, so a script has to ask the frontend API for one.
 * The host is base64 encoded inside the publishable key.
 */
export async function devBrowserToken() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!key) {
    console.error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Pull the development keys first:\n' +
        '  clerk env pull --file .env.local',
    )
    process.exit(1)
  }
  const host = Buffer.from(key.split('_').slice(2).join('_'), 'base64').toString().replace(/\$$/, '')
  const res = await fetch(`https://${host}/v1/dev_browser`, { method: 'POST' })
  if (!res.ok) throw new Error(`Clerk dev browser request failed: ${res.status}`)
  return (await res.json()).token
}

#!/usr/bin/env node
/*
 * Mint a Clerk session for the seeded demo user and print it as a cookie.
 *
 * Sign-in is a browser flow, so nothing outside a browser can post to it.
 * Without this, an agent or a script has no way to fetch a signed-in page, and
 * every operator surface (/agents, /calls, /campaigns, /keys) redirects to
 * /login.
 *
 * Three cookies, because the gate wants all three on a development instance:
 * the session token itself, the last-active stamp a browser would keep, and a
 * dev browser token. Two of them are short-lived, so re-run this rather than
 * keep a cookie. SESSION_TTL raises the session token lifetime.
 *
 * Usage: eval "$(pnpm -s session --export)"   # sets $VS_COOKIE
 *        curl -s -H "Cookie: $VS_COOKIE" http://localhost:3000/agents
 */

import {
  clerkUserByEmail,
  createClerkSession,
  createSessionToken,
  devBrowserToken,
} from './clerk.mjs'

const EMAIL = process.env.SEED_EMAIL || 'demo@voice.studio'
const EXPORT = process.argv.includes('--export')
const TTL = Number(process.env.SESSION_TTL ?? 3600)

const user = await clerkUserByEmail(EMAIL)
if (!user) {
  console.error(`No Clerk user ${EMAIL}. Run pnpm seed first.`)
  process.exit(1)
}

const session = await createClerkSession(user.id)
const { jwt } = await createSessionToken(session.id, TTL)
const devBrowser = await devBrowserToken()

// The gate treats a last-active stamp newer than the token as a stale token and
// answers 307. Both are minted in the same second here, so the stamp is backed
// off far enough that the comparison cannot tip the wrong way.
const activeAt = Math.floor(Date.now() / 1000) - 300

const cookie = [
  `__session=${jwt}`,
  `__client_uat=${activeAt}`,
  `__clerk_db_jwt=${devBrowser}`,
].join('; ')

console.log(EXPORT ? `export VS_COOKIE='${cookie}'` : cookie)

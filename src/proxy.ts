import { clerkMiddleware } from '@clerk/nextjs/server'

/*
 * Attaches the Clerk session to every request. It deliberately decides nothing.
 *
 * Clerk deprecated path-matched gating (`createRouteMatcher`) because a matcher
 * can diverge from how Next actually routes a request and leave a protected
 * resource reachable. The gate is per resource instead, and every resource
 * already has one:
 *
 *   - the `(studio)` and `(ops)` layouts call `requireAuth()`, which redirects
 *     to /login, so every operator surface inherits the gate
 *   - `/api/internal/*` calls `getAuth()` and answers 401
 *   - `/api/v1`, `/api/media`, `/widget` and `/sdk` authenticate their own
 *     credential: an API key, a `vst_` session token, or nothing because they
 *     are static
 *
 * Adding a resource means adding its check. Never add a bypass, in any
 * environment.
 */
export default clerkMiddleware()

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js)$).*)'],
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/*
 * The whole gate. Everything not listed here is private, so a new operator
 * surface is protected the moment it exists. Each entry earns its place:
 *
 *   /login, /signup   Clerk's own screens, mounted as catch-alls
 *   /api/v1           other people's software, guarded by our API keys
 *   /api/media        widget and SDK turns, guarded by a vst_ session token
 *   /widget           the embeddable page, guarded by a publishable key
 *   /sdk              the static browser script
 */
const isPublic = createRouteMatcher([
  '/login(.*)',
  '/signup(.*)',
  '/api/v1(.*)',
  '/api/media(.*)',
  '/widget(.*)',
  '/sdk(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (isPublic(request)) return
  await auth.protect()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js)$).*)'],
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define which routes should be protected by Clerk middleware.
// These are the routes that *require* an authenticated user.
// The sign-in and sign-up pages are intentionally *not* included here,
// as Clerk's middleware will automatically redirect unauthenticated users to them.
const isProtectedRoute = createRouteMatcher([
  '/', // Protect the main application page
  '/api(.*)', // Protect all API routes
  // Add any other routes that require authentication here, e.g., '/dashboard(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname

  // Allow map generation route without auth (server-to-server calls)
  if (pathname === '/api/generate-map') {
    return
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }
});

export const config = {
  matcher: [
    // Match all routes except static files and /_next/
    // This ensures Clerk's middleware runs for all relevant paths.
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Public routes that do NOT require auth:
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Allow this server-to-server call without auth:
  "/api/generate-map",
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // Helpful debug to verify middleware is hit for every request (remove later if noisy)
  console.log("[MW] hit", { pathname })

  // Skip protection for public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Protect everything else (includes /, /shopkeepers, and all /api/*)
  // NOTE: In your Clerk version, protect() is on the auth object passed into the callback
  await auth.protect()

  return NextResponse.next()
})

// Ensure middleware runs for app pages and API routes; skip static files and Next internals
export const config = {
  matcher: [
    // All routes except files with an extension and Next internals
    "/((?!.*\\..*|_next).*)",
    "/",
    // Explicitly include API/TRPC
    "/(api|trpc)(.*)",
  ],
}

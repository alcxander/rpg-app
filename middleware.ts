import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes should be protected.
// You can refine these based on your app surface area.
const isProtectedRoute = createRouteMatcher([
  "/",
  "/shopkeepers(.*)",
  "/api(.*)",
]);

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl;

  // Always initialize auth() so Clerk attaches request metadata for getAuth().
  const a = auth();

  // Allow map generation route without auth (server-to-server calls)
  if (pathname === "/api/generate-map") {
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    a.protect();
  }

  // Explicitly continue
  return NextResponse.next();
});

export const config = {
  // Run middleware for app pages and API routes; skip static files and Next internals
  matcher: [
    "/((?!_next|static|.*\\..*|favicon.ico).*)",
    "/(api|trpc)(.*)",
  ],
};

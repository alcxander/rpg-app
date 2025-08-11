import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that do NOT require auth:
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Allow this server-to-server call without auth:
  "/api/generate-map",
]);

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl;

  // Log to confirm middleware is running for this path.
  // You can comment this out later if it gets too noisy.
  console.log("[MW] hit", { pathname });

  // Always initialize auth to attach Clerk request state for downstream getAuth/auth calls.
  const a = auth();

  // Public routes continue without protection.
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect everything else, including /api/campaigns and /shopkeepers.
  a.protect();
  return NextResponse.next();
});

// Match all app and API routes; skip Next internals and static assets.
export const config = {
  matcher: [
    // All routes except: - files with an extension - _next (internals) - favicon
    "/((?!.+\\.[\\w]+$|_next).*)",
    // And always include API and TRPC explicitly:
    "/(api|trpc)(.*)",
  ],
};

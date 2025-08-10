/**
 * Server-side Supabase clients for Route Handlers and Server Actions.
 *
 * - createAdminClient(): Uses the service role key (bypasses RLS). Never import into client components.
 * - createServerSupabaseClient(clerkSessionToken): RLS-aware client scoped to a user via Clerk session token.
 *
 * Backwards compatibility:
 * - export { createClient } as alias to createAdminClient, because some existing routes
 *   may import { createClient } from "@/lib/supabaseAdmin".
 */
import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js"

type AnyClient = SupabaseClient<any, any, any>

function requireEnv(name: string, val?: string | null): string {
  if (!val) {
    console.error(`[supabaseAdmin] Missing env var: ${name}`)
    throw new Error(`Missing environment variable: ${name}`)
  }
  return val
}

/**
 * Admin client (bypasses RLS) - for privileged server mutations.
 */
export function createAdminClient(): AnyClient {
  // Prefer server vars, but support NEXT_PUBLIC_* for environments that only expose those.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const finalUrl = requireEnv("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", url)
  const finalKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", serviceKey)

  const client = supabaseCreateClient(finalUrl, finalKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Source": "admin" } },
  })
  return client
}

/**
 * RLS-aware client using a Clerk session JWT (from getAuth(req).getToken()).
 */
export function createServerSupabaseClient(clerkSessionToken: string): AnyClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const finalUrl = requireEnv("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", url)
  const finalAnon = requireEnv("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", anon)

  const client = supabaseCreateClient(finalUrl, finalAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${clerkSessionToken}`,
        "X-Client-Source": "rls",
      },
    },
  })
  return client
}

// Back-compat alias for older imports.
export { createAdminClient as createClient }

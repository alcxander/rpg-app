/**
 * Server-side Supabase clients used by Route Handlers and Server Actions.
 * - createAdminClient: Uses the service role key. Never import into client code.
 * - createServerSupabaseClient: RLS-aware client using a Clerk session JWT.
 *
 * Backwards-compat: export { createClient } as an alias to createAdminClient,
 * since earlier code imported { createClient } from this module.
 */
import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js"

type AnyClient = SupabaseClient<any, any, any>

function required(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`[supabaseAdmin] Missing env var: ${name}`)
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

/**
 * Admin client (bypasses RLS) - use for privileged server mutations.
 */
export function createAdminClient(): AnyClient {
  // Your project previously used NEXT_PUBLIC_SUPABASE_URL on the server too.
  // Keep compatibility with both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL.
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || required("SUPABASE_URL", undefined as any)
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)

  const client = supabaseCreateClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Source": "admin" } },
  })

  return client
}

/**
 * RLS-aware server client scoped to a user via Clerk session token.
 * This is preferred for most server routes so RLS policies apply.
 */
export function createServerSupabaseClient(clerkSessionToken: string): AnyClient {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || required("SUPABASE_URL", undefined as any)
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    required("SUPABASE_ANON_KEY", undefined as any)

  const client = supabaseCreateClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${clerkSessionToken}`,
        "X-Client-Source": "rls",
      },
    },
  })

  return client
}

// Backwards compatibility alias (older code used { createClient } from this file)
export { createAdminClient as createClient }

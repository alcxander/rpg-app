/**
 * Server-side Supabase clients:
 * - createAdminClient(): service role key (bypasses RLS). Server-only.
 * - createServerSupabaseClient(): RLS-aware client using Clerk session token.
 * Back-compat: export { createClient } as alias to createAdminClient.
 */
import { createClient as supabaseCreateClient, type SupabaseClient } from "@supabase/supabase-js"

type AnyClient = SupabaseClient<any, any, any>

function required(name: string, val?: string | null): string {
  if (!val) {
    console.error(`[supabaseAdmin] Missing env var: ${name}`)
    throw new Error(`Missing environment variable: ${name}`)
  }
  return val
}

export function createAdminClient(): AnyClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const finalUrl = required("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", url)
  const finalKey = required("SUPABASE_SERVICE_ROLE_KEY", key)
  return supabaseCreateClient(finalUrl, finalKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Source": "admin" } },
  })
}

export function createServerSupabaseClient(clerkSessionToken: string): AnyClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const finalUrl = required("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", url)
  const finalAnon = required("SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY", anon)
  return supabaseCreateClient(finalUrl, finalAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${clerkSessionToken}`, "X-Client-Source": "rls" } },
  })
}

// Back-compat alias
export { createAdminClient as createClient }

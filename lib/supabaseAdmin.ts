/**
 * Supabase Admin client for server-side routes.
 * Never import this into client components (service key must remain server-only).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("[supabaseAdmin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
    throw new Error("Supabase admin not configured")
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

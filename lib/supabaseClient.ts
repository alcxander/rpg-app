// lib/supabaseClient.ts
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Single client instance to avoid multiple GoTrueClient warnings
let browserClientSingleton: SupabaseClient<Database> | null = null
// We inject the Clerk JWT into every REST request via a custom fetch
let currentAuthToken: string | null = null

export const createClient = () => {
  if (!browserClientSingleton) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error(
        "Missing Supabase client-side environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      )
    }
    browserClientSingleton = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        // Inject Authorization for EVERY REST call without spinning up more clients
        global: {
          fetch: async (url, init = {}) => {
            const headers = new Headers(init.headers || {})
            if (currentAuthToken) {
              headers.set("Authorization", `Bearer ${currentAuthToken}`)
            }
            return fetch(url, { ...init, headers })
          },
        },
        auth: {
          // Avoid using the internal GoTrue session store in the browser for our Clerk-based flow
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    )
  }
  return browserClientSingleton
}

export const createBrowserClient = createClient

export const createBrowserClientWithToken = (token: string) => {
  const client = createClient()
  // Store token for REST and update Realtime
  currentAuthToken = token
  try {
    // @ts-expect-error realtime.setAuth exists on sub-client
    client.realtime.setAuth(token)
  } catch {}
  return client
}

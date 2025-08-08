// lib/supabaseAdmin.ts (for server-side with RLS-awareness)
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types'; // Assuming you generate this from Supabase CLI

// Admin client (bypasses RLS - use with caution for privileged operations)
let supabaseAdminClient: ReturnType<typeof createClient<Database>> | null = null;

export const createAdminClient = () => {
  if (!supabaseAdminClient) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('Missing Supabase server-side environment variables: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
    }
    supabaseAdminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false, // Prevents storing session in browser for server-side
        },
      }
    );
  }
  return supabaseAdminClient;
};

// User-scoped server-side client (respects RLS, authenticates with Clerk token)
// This is the preferred client for most API route operations
export const createServerSupabaseClient = (clerkSessionToken: string) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase client-side environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  // Create a new client for each request to ensure it's scope to the current user
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${clerkSessionToken}`,
        },
      },
      auth: {
        persistSession: false, // Important for server-side clients
      },
    }
  );
};

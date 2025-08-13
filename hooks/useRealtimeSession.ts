"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { createClient } from "@/lib/supabaseClient"

interface Session {
  id: string
  name: string
  campaign_id: string
  created_at: string
  updated_at: string
  dm_user_id: string
}

export function useRealtimeSession(sessionId: string | null) {
  const { getToken } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setLoading(false)
      return
    }

    const loadSession = async () => {
      try {
        console.log("[useRealtimeSession] Loading session:", sessionId)
        setLoading(true)
        setError(null)

        // Get the Supabase token from Clerk
        const token = await getToken({ template: "supabase" })
        if (!token) {
          throw new Error("No Supabase token available")
        }

        // Create Supabase client with the token
        const supabase = createClient(token)

        // Fetch the session
        const { data, error: fetchError } = await supabase.from("sessions").select("*").eq("id", sessionId).single()

        if (fetchError) {
          console.error("[useRealtimeSession] Fetch error:", fetchError)
          throw new Error(fetchError.message)
        }

        console.log("[useRealtimeSession] Session loaded:", data)
        setSession(data)
      } catch (err: any) {
        console.error("[useRealtimeSession] Error:", err)
        setError(err.message || "Failed to load session")
        setSession(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId, getToken])

  return { session, loading, error }
}

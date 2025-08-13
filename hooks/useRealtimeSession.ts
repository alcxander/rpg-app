"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeSessionProps {
  sessionId: string
  onUpdate?: () => void
}

interface SessionData {
  id: string
  name: string
  campaign_id: string
  dm_id: string
  created_at: string
  updated_at: string
}

export function useRealtimeSession({ sessionId, onUpdate }: UseRealtimeSessionProps) {
  const { user, isLoaded } = useUser()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !user || !sessionId) {
      setLoading(false)
      return
    }

    let channel: RealtimeChannel | null = null

    const setupRealtimeSession = async () => {
      try {
        console.log("[useRealtimeSession] Setting up for session:", sessionId)

        // Get the Clerk token
        const token = await user.getToken({ template: "supabase" })
        if (!token) {
          throw new Error("No Supabase token available")
        }

        // Create Supabase client with token
        const supabase = createBrowserClientWithToken(token)

        // Fetch initial session data
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single()

        if (sessionError) {
          console.error("[useRealtimeSession] Failed to fetch session:", sessionError)
          setError(`Failed to load session: ${sessionError.message}`)
          setLoading(false)
          return
        }

        console.log("[useRealtimeSession] Session loaded:", sessionData)
        setSession(sessionData)
        setError(null)

        // Set up realtime subscription
        channel = supabase
          .channel(`session-${sessionId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "sessions",
              filter: `id=eq.${sessionId}`,
            },
            (payload) => {
              console.log("[useRealtimeSession] Session updated:", payload)
              if (payload.new) {
                setSession(payload.new as SessionData)
              }
              onUpdate?.()
            },
          )
          .subscribe((status) => {
            console.log("[useRealtimeSession] Subscription status:", status)
          })

        setLoading(false)
      } catch (err) {
        console.error("[useRealtimeSession] Setup error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setLoading(false)
      }
    }

    setupRealtimeSession()

    return () => {
      if (channel) {
        console.log("[useRealtimeSession] Cleaning up channel")
        channel.unsubscribe()
      }
    }
  }, [sessionId, user, isLoaded, onUpdate])

  return { session, loading, error }
}

"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface SessionData {
  id: string
  name: string
  campaign_id: string
  active: boolean
  created_at: string
  updated_at: string
}

interface UseRealtimeSessionReturn {
  sessionData: SessionData | null
  isLoading: boolean
  error: string | null
  joinSession: () => Promise<void>
  leaveSession: () => void
}

export function useRealtimeSession(sessionId: string): UseRealtimeSessionReturn {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const hasJoined = useRef(false)

  const joinSession = async () => {
    if (!sessionId || hasJoined.current) return

    console.log("[useRealtimeSession] Attempting to join session:", sessionId)
    setIsLoading(true)
    setError(null)

    try {
      // Use the join-session API endpoint which handles permissions properly
      const response = await fetch("/api/join-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      })

      console.log("[useRealtimeSession] Join response:", {
        ok: response.ok,
        status: response.status,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to join session: ${response.status}`)
      }

      const data = await response.json()
      console.log("[useRealtimeSession] Join successful:", data)

      setSessionData(data.session)
      hasJoined.current = true

      // Set up realtime subscription
      const channel = supabase
        .channel(`session:${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            console.log("[useRealtimeSession] Session update:", payload)
            if (payload.new) {
              setSessionData(payload.new as SessionData)
            }
          },
        )
        .subscribe()

      channelRef.current = channel
      console.log("[useRealtimeSession] Realtime subscription established")
    } catch (err) {
      console.error("[useRealtimeSession] Join failed:", err)
      setError(err instanceof Error ? err.message : "Failed to join session")
    } finally {
      setIsLoading(false)
    }
  }

  const leaveSession = () => {
    console.log("[useRealtimeSession] Leaving session:", sessionId)

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    setSessionData(null)
    setError(null)
    hasJoined.current = false
  }

  // Auto-join on mount
  useEffect(() => {
    if (sessionId && !hasJoined.current) {
      joinSession()
    }

    return () => {
      leaveSession()
    }
  }, [sessionId])

  return {
    sessionData,
    isLoading,
    error,
    joinSession,
    leaveSession,
  }
}

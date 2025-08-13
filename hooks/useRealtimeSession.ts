"use client"

import { useState, useRef, useCallback } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import { useAuth } from "@clerk/nextjs"

interface UseRealtimeSessionProps {
  sessionId: string | null
  onSessionUpdate?: (session: any) => void
  onError?: (error: string) => void
}

interface UseRealtimeSessionReturn {
  isConnected: boolean
  isJoining: boolean
  error: string | null
  joinSession: () => Promise<void>
  leaveSession: () => void
}

export function useRealtimeSession({
  sessionId,
  onSessionUpdate,
  onError,
}: UseRealtimeSessionProps): UseRealtimeSessionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { getToken } = useAuth()

  const joinSession = async () => {
    if (!sessionId) {
      setError("No session ID provided")
      onError?.("No session ID provided")
      return
    }

    if (isJoining || isConnected) return

    setIsJoining(true)
    setError(null)

    try {
      // Get the Supabase token
      const token = await getToken({ template: "supabase" })
      if (!token) {
        throw new Error("Failed to get authentication token")
      }

      // Create Supabase client with token
      const supabase = createBrowserClientWithToken(token)

      // First, join the session via API
      const response = await fetch("/api/join-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to join session")
      }

      // Set up realtime subscription
      const channel = supabase.channel(`session:${sessionId}`)

      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, (payload) => {
          console.log("Session update:", payload)
          onSessionUpdate?.(payload.new)
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, (payload) => {
          console.log("Battle update:", payload)
          onSessionUpdate?.(payload.new)
        })
        .subscribe((status) => {
          console.log("Realtime subscription status:", status)
          if (status === "SUBSCRIBED") {
            setIsConnected(true)
          } else if (status === "CHANNEL_ERROR") {
            setError("Failed to connect to realtime updates")
            onError?.("Failed to connect to realtime updates")
          }
        })

      channelRef.current = channel
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      onError?.(errorMessage)
      console.error("Failed to join session:", err)
    } finally {
      setIsJoining(false)
    }
  }

  const leaveSession = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    setIsConnected(false)
    setError(null)
  }, [])

  return {
    isConnected,
    isJoining,
    error,
    joinSession,
    leaveSession,
  }
}

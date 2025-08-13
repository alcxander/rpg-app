"use client"

import { useState, useRef, useCallback } from "react"
import { useAuth } from "@clerk/nextjs"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeSessionReturn {
  isConnected: boolean
  error: string | null
  joinSession: (sessionId: string) => Promise<void>
  leaveSession: () => void
}

export function useRealtimeSession(): UseRealtimeSessionReturn {
  const { getToken } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const joinSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        setError("Session ID is required")
        return
      }

      try {
        setError(null)

        // Get the Supabase token
        const token = await getToken({ template: "supabase" })
        if (!token) {
          throw new Error("Failed to get authentication token")
        }

        // Create Supabase client with token
        const supabase = createBrowserClientWithToken(token)

        // Leave existing session if any
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }

        // Join the session channel
        const channel = supabase.channel(`session:${sessionId}`)

        channel
          .on("presence", { event: "sync" }, () => {
            console.log("Presence synced")
            setIsConnected(true)
          })
          .on("presence", { event: "join" }, ({ key, newPresences }) => {
            console.log("User joined:", key, newPresences)
          })
          .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
            console.log("User left:", key, leftPresences)
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              // Track presence
              await channel.track({
                user_id: token,
                online_at: new Date().toISOString(),
              })
            }
          })

        channelRef.current = channel
      } catch (err) {
        console.error("Failed to join session:", err)
        setError(err instanceof Error ? err.message : "Failed to join session")
        setIsConnected(false)
      }
    },
    [getToken],
  )

  const leaveSession = useCallback(async () => {
    if (channelRef.current) {
      try {
        const token = await getToken({ template: "supabase" })
        if (token) {
          const supabase = createBrowserClientWithToken(token)
          await supabase.removeChannel(channelRef.current)
        }
      } catch (err) {
        console.error("Error leaving session:", err)
      }

      channelRef.current = null
      setIsConnected(false)
    }
  }, [getToken])

  return {
    isConnected,
    error,
    joinSession,
    leaveSession,
  }
}

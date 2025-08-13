"use client"

import { useState, useRef, useCallback } from "react"
import { useUser } from "@clerk/nextjs"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeSessionProps {
  sessionId: string | null
}

export function useRealtimeSession({ sessionId }: UseRealtimeSessionProps) {
  const { user } = useUser()
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const joinSession = async () => {
    if (!sessionId) {
      setError("No session ID provided")
      return
    }

    if (!user) {
      setError("User not authenticated")
      return
    }

    try {
      setError(null)

      // Create Supabase client with user token
      const supabase = await createBrowserClientWithToken()
      if (!supabase) {
        setError("Failed to create Supabase client")
        return
      }

      // Clean up existing channel
      if (channelRef.current) {
        await channelRef.current.unsubscribe()
        channelRef.current = null
      }

      // Join the session via API
      const response = await fetch("/api/join-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId: user.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to join session")
      }

      // Create realtime channel
      const channel = supabase.channel(`session:${sessionId}`)

      channel
        .on("presence", { event: "sync" }, () => {
          console.log("Presence synced")
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
              user_id: user.id,
              user_name: user.fullName || user.firstName || "Anonymous",
              online_at: new Date().toISOString(),
            })
            setIsConnected(true)
            console.log("Successfully joined session:", sessionId)
          } else if (status === "CHANNEL_ERROR") {
            setError("Failed to connect to session")
            setIsConnected(false)
          }
        })

      channelRef.current = channel
    } catch (err) {
      console.error("Error joining session:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
      setIsConnected(false)
    }
  }

  const leaveSession = useCallback(async () => {
    if (channelRef.current) {
      await channelRef.current.unsubscribe()
      channelRef.current = null
    }
    setIsConnected(false)
    setError(null)
  }, [])

  return {
    isConnected,
    error,
    joinSession,
    leaveSession,
  }
}

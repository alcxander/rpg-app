"use client"

import { useState, useRef, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeSessionProps {
  sessionId: string | null
  onParticipantsUpdate?: (participants: any[]) => void
  onMessagesUpdate?: (messages: any[]) => void
}

interface UseRealtimeSessionReturn {
  isConnected: boolean
  participants: any[]
  messages: any[]
  joinSession: () => Promise<void>
  leaveSession: () => void
  sendMessage: (content: string) => Promise<void>
  error: string | null
}

export function useRealtimeSession({
  sessionId,
  onParticipantsUpdate,
  onMessagesUpdate,
}: UseRealtimeSessionProps): UseRealtimeSessionReturn {
  const { user, getToken } = useUser()
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const joinSession = async () => {
    if (!sessionId) {
      setError("No session ID provided")
      return
    }

    if (!user || !getToken) {
      setError("User not authenticated")
      return
    }

    try {
      setError(null)

      // Get the Clerk token and create Supabase client
      const token = await getToken({ template: "supabase" })
      if (!token) {
        throw new Error("Failed to get authentication token")
      }

      const supabase = createBrowserClientWithToken(token)

      // Join the session via API
      const response = await fetch("/api/join-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          userId: user.id,
          userName: user.fullName || user.firstName || "Unknown User",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to join session")
      }

      // Set up realtime subscription
      const channel = supabase
        .channel(`session-${sessionId}`)
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState()
          const currentParticipants = Object.values(state).flat()
          setParticipants(currentParticipants)
          onParticipantsUpdate?.(currentParticipants)
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          setParticipants((prev) => [...prev, ...newPresences])
        })
        .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
          setParticipants((prev) => prev.filter((p) => !leftPresences.some((lp) => lp.user_id === p.user_id)))
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const newMessage = payload.new
            setMessages((prev) => [...prev, newMessage])
            onMessagesUpdate?.([...messages, newMessage])
          },
        )

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            user_name: user.fullName || user.firstName || "Unknown User",
            online_at: new Date().toISOString(),
          })
          setIsConnected(true)
        }
      })

      channelRef.current = channel
    } catch (err: any) {
      console.error("Error joining session:", err)
      setError(err.message || "Failed to join session")
    }
  }

  const leaveSession = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    setIsConnected(false)
    setParticipants([])
    setMessages([])
  }

  const sendMessage = async (content: string) => {
    if (!sessionId || !user) {
      throw new Error("Cannot send message: missing session or user")
    }

    try {
      const response = await fetch("/api/sessions/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          content,
          userId: user.id,
          userName: user.fullName || user.firstName || "Unknown User",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send message")
      }
    } catch (err: any) {
      console.error("Error sending message:", err)
      throw err
    }
  }

  useEffect(() => {
    return () => {
      leaveSession()
    }
  }, [])

  return {
    isConnected,
    participants,
    messages,
    joinSession,
    leaveSession,
    sendMessage,
    error,
  }
}

"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import type { SessionState } from "@/types"

export interface RealtimeSession {
  id: string
  name: string
  campaign_id: string
  dm_id: string
  created_at: string
  background_image?: string
}

export const useRealtimeSession = (sessionId: string | null) => {
  const { user, getToken } = useUser()
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId || !user) {
      setLoading(false)
      return
    }

    const loadSession = async () => {
      try {
        console.log("[useRealtimeSession] Loading session:", sessionId)
        setLoading(true)
        setError(null)

        const token = await getToken({ template: "supabase" })
        if (!token) {
          throw new Error("No authentication token available")
        }

        const response = await fetch(`/api/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[useRealtimeSession] API error:", response.status, errorText)
          throw new Error(`Failed to load session: ${response.status}`)
        }

        const data = await response.json()
        console.log("[useRealtimeSession] Session loaded:", data)
        setSession(data.session)

        // Initialize session state
        setSessionState({
          id: sessionId,
          map: data.session?.background_image || null,
          tokens: [],
        })
      } catch (err) {
        console.error("[useRealtimeSession] Error loading session:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setSession(null)
        setSessionState(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId, user, getToken])

  const updateSessionState = (newState: SessionState) => {
    setSessionState(newState)
  }

  return {
    session,
    sessionState,
    updateSessionState,
    loading,
    error,
    refetch: () => {
      if (sessionId && user) {
        setLoading(true)
        // Trigger reload by updating a dependency
      }
    },
  }
}

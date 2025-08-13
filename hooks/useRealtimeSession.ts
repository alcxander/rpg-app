"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabaseClient"
import type { RealtimeSession, SessionState, UseRealtimeSessionReturn, BattleEntity, ChatMessage } from "@/types"

export function useRealtimeSession(sessionId: string): UseRealtimeSessionReturn {
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>({
    entities: [],
    messages: [],
    initiative_order: [],
    current_turn: 0,
  })

  const supabase = createClient()

  const fetchSession = useCallback(async () => {
    if (!sessionId) return

    try {
      setLoading(true)
      setError(null)

      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select(`
          *,
          participants:session_participants(*)
        `)
        .eq("id", sessionId)
        .single()

      if (sessionError) throw sessionError

      setSession(sessionData)

      // Fetch current battle if exists
      if (sessionData.current_battle_id) {
        const { data: battleData, error: battleError } = await supabase
          .from("battles")
          .select(`
            *,
            entities:battle_entities(*),
            initiative_order:battle_initiative(*)
          `)
          .eq("id", sessionData.current_battle_id)
          .single()

        if (battleError) throw battleError

        setSessionState((prev) => ({
          ...prev,
          battle: battleData,
          entities: battleData.entities || [],
          initiative_order: battleData.initiative_order || [],
        }))
      }

      // Fetch recent messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("session_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (messagesError) throw messagesError

      setSessionState((prev) => ({
        ...prev,
        messages: messagesData.reverse() || [],
      }))
    } catch (err) {
      console.error("Error fetching session:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch session")
    } finally {
      setLoading(false)
    }
  }, [sessionId, supabase])

  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    setSessionState((prev) => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSessionState((prev) => ({
              ...prev,
              messages: [...prev.messages, payload.new as ChatMessage],
            }))
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battle_entities",
          filter: `battle_id=eq.${session?.current_battle_id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setSessionState((prev) => ({
              ...prev,
              entities: prev.entities.map((entity) =>
                entity.id === payload.new.id ? (payload.new as BattleEntity) : entity,
              ),
            }))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, session?.current_battle_id, supabase])

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
    sessionState,
    updateSessionState,
  }
}

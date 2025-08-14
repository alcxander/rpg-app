"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { createBrowserClientWithToken } from "@/lib/supabaseClient"
import type { MapData, MapToken, SessionParticipant, Battle } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { useAuth } from "@clerk/nextjs"
import { formatCoordinate } from "@/lib/utils"
import { createLogger } from "@/lib/logger"

const log = createLogger("useRealtimeSession")

type RealtimeEvent =
  | { type: "MOVE_TOKEN"; payload: { tokenId: string; x: number; y: number } }
  | { type: "UPDATE_MAP"; payload: MapData }
  | { type: "ADD_CHAT_MESSAGE"; payload: string }
  | { type: "UPDATE_BATTLE"; payload: Battle }
  | { type: "UPDATE_PARTICIPANTS"; payload: SessionParticipant[] }

export type SessionState = {
  map: MapData | null
  battle: (Battle & { name?: string; slug?: string; background_image?: string | null; initiative?: any }) | null
  battles: (Battle & { name?: string; slug?: string; background_image?: string | null; initiative?: any })[]
  chatLog: string[]
  participants: SessionParticipant[]
}

export function useRealtimeSession(sessionId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth()

  const [sessionState, setSessionState] = useState<SessionState>({
    map: null,
    battle: null,
    battles: [],
    chatLog: [],
    participants: [],
  })
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<SupabaseClient | null>(null)
  const initializedForSessionRef = useRef<string | null>(null)
  const lastMsgRef = useRef<string>("")

  /** Init or refresh Supabase client when auth changes */
  useEffect(() => {
    let cancelled = false
    const initClient = async () => {
      if (!isLoaded || !isSignedIn) return
      const token = await getToken({ template: "supabase" })
      if (!token || cancelled) return

      if (!clientRef.current) {
        log.info("Creating Supabase client with token")
        clientRef.current = createBrowserClientWithToken(token)
      } else {
        try {
          log.info("Refreshing Supabase Realtime auth token")
          /* @ts-expect-error */ clientRef.current.realtime.setAuth(token)
        } catch (err) {
          log.warn("Failed to refresh token", err)
        }
      }
    }

    initClient()

    // Refresh token on tab focus
    const onFocus = async () => {
      log.info("Tab focus: refreshing Supabase token")
      const t = await getToken({ template: "supabase" })
      if (t) {
        try {
          /* @ts-expect-error */ clientRef.current?.realtime.setAuth(t)
        } catch (err) {
          log.warn("Failed to refresh token on focus", err)
        }
      }
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
    }
  }, [isLoaded, isSignedIn, getToken])

  /** Map token processor */
  const processTokenData = useCallback((rawToken: any): MapToken => ({
    id: String(rawToken.id || uuidv4()),
    type: rawToken.type === "monster" || rawToken.type === "pc" ? rawToken.type : "pc",
    x: Number(rawToken.x || 0),
    y: Number(rawToken.y || 0),
    name: String(rawToken.name || "Unknown Token"),
    image: String(rawToken.image || ""),
    stats: typeof rawToken.stats === "object" && rawToken.stats !== null ? rawToken.stats : {},
  }), [])

  /** Broadcast event helper */
  const emitEvent = useCallback(
    (event: RealtimeEvent) => {
      if (channel) {
        log.info("Emitting event:", event.type, event.payload)
        try {
          channel.send({ type: "broadcast", event: event.type, payload: event.payload })
        } catch (err) {
          log.error("emitEvent failed", err)
        }
      }
    },
    [channel],
  )

  /** Move + log with dedupe */
  const moveTokenAndLog = useCallback(
    (tokenId: string, x: number, y: number) => {
      const coordString = `${formatCoordinate(x, y)}`
      log.info("Moving token:", tokenId, "to", coordString)

      setSessionState(prev => {
        if (!prev.map) return prev

        const updatedTokens = prev.map.tokens.map(t =>
          String(t.id) === String(tokenId) ? { ...t, x: Number(x), y: Number(y) } : t
        )

        const moved = updatedTokens.find(t => String(t.id) === String(tokenId))
        const line = `${moved?.name || "Token"} moved to ${coordString}`
        const last = prev.chatLog[prev.chatLog.length - 1]
        const chatLog = last === line ? prev.chatLog : [...prev.chatLog, line]

        lastMsgRef.current = line

        return { ...prev, map: { ...prev.map, tokens: updatedTokens }, chatLog }
      })

      emitEvent({ type: "ADD_CHAT_MESSAGE", payload: coordString })
      emitEvent({ type: "MOVE_TOKEN", payload: { tokenId, x, y } })
    },
    [emitEvent],
  )

  /** Load battles list */
  const loadBattles = useCallback(async (sid: string) => {
    const client = clientRef.current
    if (!client) return
    log.info("Loading battles for session:", sid)

    const { data, error } = await client
      .from("battles")
      .select("*")
      .eq("session_id", sid)
      .order("created_at", { ascending: false })
    if (error) {
      log.error("Error loading battles:", error)
    } else if (Array.isArray(data)) {
      log.info("Battles loaded:", data.length)
      setSessionState(prev => ({
        ...prev,
        battles: data,
        battle: prev.battle ?? data[0] ?? null,
      }))
    }
  }, [])

  /** Main realtime session join + subscriptions */
  useEffect(() => {
    const client = clientRef.current
    if (!client || !isLoaded) return
    if (!sessionId) {
      log.info("No sessionId — clearing state")
      setIsLoading(false)
      if (channel) {
        client.removeChannel(channel)
        setChannel(null)
      }
      initializedForSessionRef.current = null
      return
    }
    if (initializedForSessionRef.current === sessionId) return
    initializedForSessionRef.current = sessionId

    setIsLoading(true)
    setError(null)

    const run = async () => {
      try {
        log.info("Joining session via API:", sessionId)
        const joinResponse = await fetch("/api/join-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })

        if (!joinResponse.ok) {
          const errorData = await joinResponse.json().catch(() => ({}))
          log.error("Join session failed:", errorData)
          setError(errorData.error || `Session "${sessionId}" not found or not accessible.`)
          setIsLoading(false)
          return
        }

        const joinData = await joinResponse.json()
        log.info("Session joined:", joinData)

        const sessionData = joinData.session
        setSessionState(prev => ({
          ...prev,
          map: sessionData.map
            ? { ...sessionData.map, tokens: (sessionData.map.tokens || []).map(processTokenData) }
            : null,
          participants: sessionData.participants || [],
        }))

        await loadBattles(sessionId)

        // Clean old channel
        if (channel) {
          log.info("Removing old realtime channel")
          client.removeChannel(channel)
          setChannel(null)
        }

        log.info("Subscribing to realtime channel:", `session:${sessionId}`)
        const newChannel = client.channel(`session:${sessionId}`, { config: { broadcast: { self: false } } })
        newChannel.on("broadcast", { event: "*" }, payload => {
          const event = payload.event as RealtimeEvent["type"]
          log.info("Realtime broadcast:", event, payload.payload)
          const data = payload.payload
          setSessionState(prev => {
            switch (event) {
              case "MOVE_TOKEN":
                if (!prev.map) return prev
                const { tokenId, x, y } = data as { tokenId: string; x: number; y: number }
                return {
                  ...prev,
                  map: {
                    ...prev.map,
                    tokens: prev.map.tokens.map(t =>
                      String(t.id) === String(tokenId) ? { ...t, x: Number(x), y: Number(y) } : t
                    ),
                  },
                }
              case "UPDATE_MAP":
                return { ...prev, map: { ...data, tokens: (data.tokens || []).map(processTokenData) } }
              case "ADD_CHAT_MESSAGE":
                return typeof data === "string" && prev.chatLog[prev.chatLog.length - 1] !== data
                  ? { ...prev, chatLog: [...prev.chatLog, data] }
                  : prev
              case "UPDATE_BATTLE":
                return { ...prev, battle: data as Battle }
              case "UPDATE_PARTICIPANTS":
                return { ...prev, participants: data as SessionParticipant[] }
              default:
                return prev
            }
          })
        })

        newChannel.subscribe(status => {
          if (status === "SUBSCRIBED") {
            log.info("Realtime channel subscribed")
            setIsLoading(false)
          }
          if (status === "CHANNEL_ERROR") {
            log.error("Realtime channel error")
            setError("Realtime channel error.")
            setIsLoading(false)
          }
        })

        setChannel(newChannel)
      } catch (err: any) {
        log.error("Error joining session:", err)
        setError(err.message || "Failed to load session data.")
        setIsLoading(false)
      }
    }

    run()
  }, [sessionId, isLoaded, loadBattles])

  return { sessionState, emitEvent, isLoading, error, moveTokenAndLog, setSessionState }
}

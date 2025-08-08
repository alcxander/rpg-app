'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClientWithToken } from '@/lib/supabaseClient'
import { MapData, MapToken, SessionParticipant, Battle } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'
import { useAuth } from '@clerk/nextjs'
import { formatCoordinate } from '@/lib/utils'

type RealtimeEvent =
  | { type: 'MOVE_TOKEN'; payload: { tokenId: string; x: number; y: number } }
  | { type: 'UPDATE_MAP'; payload: MapData }
  | { type: 'ADD_CHAT_MESSAGE'; payload: string }
  | { type: 'UPDATE_BATTLE'; payload: Battle }
  | { type: 'UPDATE_PARTICIPANTS'; payload: SessionParticipant[] }

export type SessionState = {
  map: MapData | null
  battle: (Battle & { name?: string; slug?: string; background_image?: string | null }) | null
  battles: (Battle & { name?: string; slug?: string; background_image?: string | null })[]
  chatLog: string[]
  participants: SessionParticipant[]
}

export function useRealtimeSession(sessionId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [sessionState, setSessionState] = useState<SessionState>({ map: null, battle: null, battles: [], chatLog: [], participants: [] })
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // keep client in ref to avoid triggering reloads
  const clientRef = useRef<SupabaseClient | null>(null)
  const battlesSubRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const initializedForSessionRef = useRef<string | null>(null)

  // Create client once (and refresh token on focus via rebuilding client, but do NOT trigger reloads)
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!isLoaded || !isSignedIn) return
      const token = await getToken({ template: 'supabase' })
      if (!token || cancelled) return
      if (!clientRef.current) {
        clientRef.current = createBrowserClientWithToken(token)
      } else {
        // try to refresh realtime auth without recreating everything
        try { /* @ts-expect-error */ clientRef.current.realtime.setAuth(token) } catch {}
      }
    }
    init()

    const onFocus = async () => {
      const t = await getToken({ template: 'supabase' })
      if (t) {
        try { /* @ts-expect-error */ clientRef.current?.realtime.setAuth(t) } catch {}
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [isLoaded, isSignedIn, getToken])

  const processTokenData = useCallback((rawToken: any): MapToken => {
    return {
      id: String(rawToken.id || uuidv4()),
      type: rawToken.type === 'monster' || rawToken.type === 'pc' ? rawToken.type : 'pc',
      x: Number(rawToken.x || 0),
      y: Number(rawToken.y || 0),
      name: String(rawToken.name || 'Unknown Token'),
      image: String(rawToken.image || ''), // allow empty; Canvas picks random
      stats: typeof rawToken.stats === 'object' && rawToken.stats !== null ? rawToken.stats : {},
    }
  }, [])

  const emitEvent = useCallback(
    (event: RealtimeEvent) => {
      if (channel) channel.send({ type: 'broadcast', event: event.type, payload: event.payload })
    },
    [channel]
  )

  const moveTokenAndLog = useCallback(
    (tokenId: string, x: number, y: number) => {
      emitEvent({ type: 'MOVE_TOKEN', payload: { tokenId, x, y } })
      const coord = formatCoordinate(x, y)
      const token = sessionState.map?.tokens.find((t) => String(t.id) === String(tokenId))
      const name = token?.name || 'Token'
      emitEvent({ type: 'ADD_CHAT_MESSAGE', payload: `${name} moved to ${coord}` })
    },
    [emitEvent, sessionState.map?.tokens]
  )

  // Load battles list
  const loadBattles = useCallback(async (sid: string) => {
    const client = clientRef.current
    if (!client) return
    const { data, error } = await client.from('battles').select('*').eq('session_id', sid).order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) {
      setSessionState((prev) => {
        const first = data[0] || null
        return {
          ...prev,
          battles: data as any[],
          battle: prev.battle ?? (first as any),
          chatLog: (prev.battle?.log || first?.log || []).map(String),
        }
      })
    }
  }, [])

  // Subscribe to new battles (once per session)
  useEffect(() => {
    const client = clientRef.current
    if (!client || !sessionId) return
    if (battlesSubRef.current) {
      client.removeChannel(battlesSubRef.current)
      battlesSubRef.current = null
    }
    const ch = client
      .channel('battles-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battles', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new as any
        setSessionState((prev) => ({
          ...prev,
          battles: [row, ...prev.battles],
          battle: prev.battle ?? row,
          chatLog: (prev.battle?.log || row.log || []).map(String),
        }))
      })
      .subscribe()
    battlesSubRef.current = ch
    return () => {
      if (battlesSubRef.current) {
        client.removeChannel(battlesSubRef.current)
        battlesSubRef.current = null
      }
    }
  }, [sessionId])

  // Main load: only when sessionId changes or first time
  useEffect(() => {
    const client = clientRef.current
    if (!client) {
      if (isLoaded) setIsLoading(false)
      return
    }
    if (!sessionId) {
      setIsLoading(false)
      if (channel) {
        client.removeChannel(channel)
        setChannel(null)
      }
      initializedForSessionRef.current = null
      return
    }

    // Avoid re-initializing if already loaded this session
    if (initializedForSessionRef.current === sessionId) return
    initializedForSessionRef.current = sessionId

    setIsLoading(true)
    setError(null)

    const run = async () => {
      try {
        const { data: sessionData, error: sessionError } = await client.from('sessions').select('*').eq('id', sessionId).maybeSingle()
        if (sessionError) {
          setError(sessionError.message)
          setIsLoading(false)
          return
        }
        if (!sessionData) {
          setError(`Session "${sessionId}" not found or not accessible.`)
          setIsLoading(false)
          return
        }

        const { data: mapDataRaw } = await client
          .from('maps')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const processedMap: MapData | null = mapDataRaw
          ? { ...mapDataRaw, tokens: (mapDataRaw.tokens || []).map(processTokenData) }
          : null

        await loadBattles(sessionId)

        setSessionState((prev) => ({
          ...prev,
          map: processedMap,
          participants: sessionData.participants || [],
        }))

        if (channel) {
          client.removeChannel(channel)
          setChannel(null)
        }

        const newChannel = client.channel(`session:${sessionId}`, { config: { broadcast: { self: true } } })
        newChannel.on('broadcast', { event: '*' }, (payload) => {
          const event = payload.event as RealtimeEvent['type']
          const data = payload.payload
          setSessionState((prev) => {
            switch (event) {
              case 'MOVE_TOKEN': {
                if (!prev.map) return prev
                const { tokenId, x, y } = data as { tokenId: string; x: number; y: number }
                const updatedTokens = prev.map.tokens.map((t) => (String(t.id) === String(tokenId) ? { ...t, x: Number(x), y: Number(y) } : t))
                return { ...prev, map: { ...prev.map, tokens: updatedTokens } }
              }
              case 'UPDATE_MAP': {
                const incoming = data as MapData
                const processed: MapData = { ...incoming, tokens: (incoming.tokens || []).map(processTokenData) }
                return { ...prev, map: processed }
              }
              case 'ADD_CHAT_MESSAGE': {
                if (typeof data === 'string') return { ...prev, chatLog: [...prev.chatLog, data] }
                return prev
              }
              case 'UPDATE_BATTLE': {
                const battle = data as any
                return { ...prev, battle, chatLog: (battle.log || []).map(String) }
              }
              case 'UPDATE_PARTICIPANTS': {
                return { ...prev, participants: data as SessionParticipant[] }
              }
              default:
                return prev
            }
          })
        })

        newChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') setIsLoading(false)
          if (status === 'CHANNEL_ERROR') {
            setError('Realtime channel error.')
            setIsLoading(false)
          }
        })
        setChannel(newChannel)
      } catch (err: any) {
        setError(err.message || 'Failed to load session data.')
        setIsLoading(false)
      }
    }

    run()

    // no cleanup here; handled by sessionId change block
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, processTokenData, isLoaded, loadBattles])

  return { sessionState, emitEvent, isLoading, error, moveTokenAndLog, setSessionState }
}

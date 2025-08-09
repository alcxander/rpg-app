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
  battle: (Battle & { name?: string; slug?: string; background_image?: string | null; initiative?: any }) | null
  battles: (Battle & { name?: string; slug?: string; background_image?: string | null; initiative?: any })[]
  chatLog: string[]
  participants: SessionParticipant[]
}

export function useRealtimeSession(sessionId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const [sessionState, setSessionState] = useState<SessionState>({ map: null, battle: null, battles: [], chatLog: [], participants: [] })
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<SupabaseClient | null>(null)
  const battlesInsertRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const battlesUpdateRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
  const initializedForSessionRef = useRef<string | null>(null)
  const lastMsgRef = useRef<string>('')

  // client + token refresh
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!isLoaded || !isSignedIn) return
      const token = await getToken({ template: 'supabase' })
      if (!token || cancelled) return
      if (!clientRef.current) {
        clientRef.current = createBrowserClientWithToken(token)
      } else {
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
      image: String(rawToken.image || ''),
      stats: typeof rawToken.stats === 'object' && rawToken.stats !== null ? rawToken.stats : {},
    }
  }, [])

  const emitEvent = useCallback(
    (event: RealtimeEvent) => {
      if (channel) channel.send({ type: 'broadcast', event: event.type, payload: event.payload })
    },
    [channel]
  )

  // Append to battle log in DB (background)
  const appendBattleLog = useCallback(async (message: string) => {
    try {
      const id = (sessionState.battle as any)?.id
      if (!id) return
      await fetch(`/api/battles/${id}/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
    } catch {}
  }, [sessionState.battle])

  // Move + log with dedupe
  const moveTokenAndLog = useCallback(
    (tokenId: string, x: number, y: number) => {
      const message = `${formatCoordinate(x,y)}` // coordinate string for later
      setSessionState((prev) => {
        if (!prev.map) return prev
        const updatedTokens = prev.map.tokens.map((t) => (String(t.id) === String(tokenId) ? { ...t, x: Number(x), y: Number(y) } : t))
        const moved = updatedTokens.find((t) => String(t.id) === String(tokenId))
        const line = `${moved?.name || 'Token'} moved to ${message}`
        const last = prev.chatLog[prev.chatLog.length - 1]
        const chatLog = last === line ? prev.chatLog : [...prev.chatLog, line]
        lastMsgRef.current = line
        return { ...prev, map: { ...prev.map, tokens: updatedTokens }, chatLog }
      })
      // Broadcast once for others
      const line = `${(sessionState.map?.tokens.find(t => String(t.id) === String(tokenId))?.name) || 'Token'} moved to ${message}`
      emitEvent({ type: 'ADD_CHAT_MESSAGE', payload: line })
      appendBattleLog(line)
      emitEvent({ type: 'MOVE_TOKEN', payload: { tokenId, x, y } })
    },
    [emitEvent, appendBattleLog, sessionState.map?.tokens]
  )

  const loadBattles = useCallback(async (sid: string) => {
    const client = clientRef.current
    if (!client) return
    const { data, error } = await client.from('battles').select('*').eq('session_id', sid).order('created_at', { ascending: false })
    if (!error && Array.isArray(data)) {
      setSessionState((prev) => {
        const byId = new Map<string, any>()
        ;(data as any[]).forEach((b) => byId.set(b.id, b))
        ;(prev.battles || []).forEach((b) => byId.set(b.id, b))
        const list = Array.from(byId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        const first = list[0] || null
        return {
          ...prev,
          battles: list as any[],
          battle: prev.battle ?? (first as any),
          chatLog: prev.chatLog.length ? prev.chatLog : (first?.log || []).map(String),
        }
      })
    }
  }, [])

  // Subscribe to INSERT and UPDATE on battles (no chatLog overwrite on update)
  useEffect(() => {
    const client = clientRef.current
    if (!client || !sessionId) return

    if (battlesInsertRef.current) client.removeChannel(battlesInsertRef.current)
    const chIns = client
      .channel('battles-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'battles', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new as any
        setSessionState((prev) => {
          const exists = prev.battles.some((b) => b.id === row.id)
          const battles = exists ? prev.battles : [row, ...prev.battles]
          return { ...prev, battles, battle: prev.battle ?? row, chatLog: prev.chatLog.length ? prev.chatLog : (row.log || []).map(String) }
        })
      })
      .subscribe()
    battlesInsertRef.current = chIns

    if (battlesUpdateRef.current) client.removeChannel(battlesUpdateRef.current)
    const chUpd = client
      .channel('battles-update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new as any
        setSessionState((prev) => {
          const battles = prev.battles.map((b) => (b.id === row.id ? row : b))
          const battle = prev.battle && prev.battle.id === row.id ? row : prev.battle
          return { ...prev, battles, battle }
        })
      })
      .subscribe()
    battlesUpdateRef.current = chUpd

    return () => {
      if (battlesInsertRef.current) client.removeChannel(battlesInsertRef.current)
      if (battlesUpdateRef.current) client.removeChannel(battlesUpdateRef.current)
      battlesInsertRef.current = null
      battlesUpdateRef.current = null
    }
  }, [sessionId])

  // Main load + realtime
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
    if (initializedForSessionRef.current === sessionId) return
    initializedForSessionRef.current = sessionId

    setIsLoading(true)
    setError(null)

    const run = async () => {
      try {
        const { data: sessionData, error: sessionError } = await client.from('sessions').select('*').eq('id', sessionId).maybeSingle()
        if (sessionError || !sessionData) {
          setError(sessionError?.message || `Session "${sessionId}" not found or not accessible.`)
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
          ? { ...mapDataRaw, tokens: (mapDataRaw.tokens || []).map((rt: any) => ({
            id: String(rt.id || uuidv4()),
            type: rt.type === 'monster' || rt.type === 'pc' ? rt.type : 'pc',
            x: Number(rt.x || 0),
            y: Number(rt.y || 0),
            name: String(rt.name || 'Unknown Token'),
            image: String(rt.image || ''),
            stats: typeof rt.stats === 'object' && rt.stats !== null ? rt.stats : {},
          })) }
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

        const newChannel = client.channel(`session:${sessionId}`, { config: { broadcast: { self: false } } })
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
                const processed: MapData = { ...incoming, tokens: (incoming.tokens || []).map((rt: any) => ({
                  id: String(rt.id || uuidv4()),
                  type: rt.type === 'monster' || rt.type === 'pc' ? rt.type : 'pc',
                  x: Number(rt.x || 0),
                  y: Number(rt.y || 0),
                  name: String(rt.name || 'Unknown Token'),
                  image: String(rt.image || ''),
                  stats: typeof rt.stats === 'object' && rt.stats !== null ? rt.stats : {},
                })) }
                return { ...prev, map: processed }
              }
              case 'ADD_CHAT_MESSAGE': {
                if (typeof data === 'string') {
                  const last = prev.chatLog[prev.chatLog.length - 1]
                  if (last === data) return prev
                  return { ...prev, chatLog: [...prev.chatLog, data] }
                }
                return prev
              }
              case 'UPDATE_BATTLE': {
                const battle = data as any
                return { ...prev, battle }
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
  }, [sessionId, isLoaded, loadBattles])

  return { sessionState, emitEvent, isLoading, error, moveTokenAndLog, setSessionState }
}

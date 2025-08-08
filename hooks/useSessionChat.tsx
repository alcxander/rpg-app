'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClientWithToken } from '@/lib/supabaseClient'

export type ChatMessage = {
  id: string
  session_id: string
  user_id: string
  content: string
  created_at: string
}

export function useSessionChat(sessionId: string | null) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth()
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)

  // token refresh (interval + focus), no nested return
  useEffect(() => {
    let cancelled = false
    let interval: any

    const init = async () => {
      if (!isLoaded || !isSignedIn) return
      const token = await getToken({ template: 'supabase' })
      if (!token || cancelled) return
      setSupabase(createBrowserClientWithToken(token))
    }
    init()

    interval = setInterval(async () => {
      if (!isLoaded || !isSignedIn) return
      const t = await getToken({ template: 'supabase' })
      if (t && !cancelled) setSupabase(createBrowserClientWithToken(t))
    }, 10 * 60 * 1000)

    const onFocus = async () => {
      const t = await getToken({ template: 'supabase' })
      if (t && !cancelled) setSupabase(createBrowserClientWithToken(t))
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [isLoaded, isSignedIn, getToken])

  const fetchMessages = useCallback(async () => {
    if (!supabase || !sessionId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('id, session_id, user_id, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    if (!error && data) setMessages(data as ChatMessage[])
    setLoading(false)
  }, [supabase, sessionId])

  useEffect(() => {
    if (!supabase) return
    if (!sessionId) {
      setMessages([])
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    fetchMessages()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    const channel = supabase.channel('messages-insert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const row = payload.new as ChatMessage
        setMessages((prev) => [...prev, row])
      })
      .subscribe()
    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, sessionId, fetchMessages])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!supabase || !sessionId || !userId) return
      const { error } = await supabase.from('messages').insert({ session_id: sessionId, user_id: userId, content })
      if (error) throw new Error(error.message)
    },
    [supabase, sessionId, userId]
  )

  return { messages, loading, sendMessage }
}

"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import type { Message } from "@/types"

export const useSessionChat = (sessionId: string | null) => {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      }
    }

    loadMessages()
  }, [sessionId])

  const sendMessage = async (content: string) => {
    if (!sessionId || !user) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    messages,
    sendMessage,
    isLoading,
  }
}

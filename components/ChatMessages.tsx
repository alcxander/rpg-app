"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { Message } from "@/types"

interface ChatMessagesProps {
  messages: Message[]
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <ScrollArea className="h-64 w-full rounded-md border p-4">
      <div className="space-y-2">
        {messages.map((message) => (
          <div key={message.id} className="text-sm">
            <span className="font-semibold">{message.user_name}:</span>{" "}
            <span
              className={
                message.message_type === "system"
                  ? "text-blue-600"
                  : message.message_type === "roll"
                    ? "text-green-600"
                    : "text-foreground"
              }
            >
              {message.message}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

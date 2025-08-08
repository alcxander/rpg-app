'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string
  session_id: string
  user_id: string
  content: string
  created_at: string
}

export function ChatMessages({
  messages,
  me,
}: {
  messages: ChatMessage[];
  me: string | null;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 h-64 flex flex-col overflow-auto">
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-1">
          {messages.map((m) => {
            const mine = me && m.user_id === me;
            const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] px-2 py-1 rounded text-sm',
                  mine ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-100'
                )}>
                  <div className="flex items-center gap-2 text-[10px] opacity-80">
                    <span>{time}</span>
                    {!mine && <span>{m.user_id.substring(0,8)}</span>}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
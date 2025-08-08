'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef } from 'react';

interface ChatLogProps {
  messages: string[];
  title?: string;
}

export function ChatLog({ messages, title = 'Activity Log' }: ChatLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="bg-gray-800 text-white border-gray-700 shadow-lg h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold text-purple-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <div ref={scrollRef} className="h-full pr-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-400 italic">No activity yet.</p>
          ) : (
            messages.map((msg, index) => (
              <p key={index} className="text-sm text-gray-300 mb-1">
                {String(msg)}
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

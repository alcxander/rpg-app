'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMemo } from 'react'
import { LootResults } from './LootResults'
import { Clipboard } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

export function LootHistory({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  entries: { createdAt: string; data: any }[]
}) {
  const list = useMemo(() => entries, [entries])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-gray-800 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-purple-400">Loot History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            {list.length === 0 && <div className="text-gray-400 text-sm">No loot generated yet.</div>}
            {list.map((e, idx) => (
              <div key={idx} className="p-3 rounded border border-gray-700 bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-gray-700 text-white"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(e.data, null, 2))}
                  >
                    <Clipboard className="w-4 h-4 mr-2" /> Copy JSON
                  </Button>
                </div>
                <LootResults result={e.data} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

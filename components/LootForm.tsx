'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

export function LootForm({
  isOpen,
  onClose,
  onGenerate,
}: {
  isOpen: boolean
  onClose: () => void
  onGenerate: (data: { cr?: string; partyLevel?: number; partyLoot?: boolean; exactLevel?: boolean }) => Promise<void> | void
}) {
  const [cr, setCr] = useState<string>('Medium')
  const [partyLevel, setPartyLevel] = useState<number>(3)
  const [partyLoot, setPartyLoot] = useState<boolean>(true)
  const [exactLevel, setExactLevel] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onGenerate({ cr, partyLevel, partyLoot, exactLevel })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-800 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl text-purple-400">Generate Loot</DialogTitle>
          <DialogDescription className="text-gray-400">Optionally tune for the current battle or party.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-gray-300">Encounter CR</Label>
            <Select value={cr} onValueChange={setCr}>
              <SelectTrigger className="col-span-3 bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="CR" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
                <SelectItem value="Deadly">Deadly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-gray-300">Party Level</Label>
            <Input type="number" value={partyLevel} onChange={(e) => setPartyLevel(parseInt(e.target.value || '0') || 0)} min={1} max={20} className="col-span-3 bg-gray-700 border-gray-600 text-white" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-gray-300">Party Loot</Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox id="partyLoot" checked={partyLoot} onCheckedChange={(v) => setPartyLoot(Boolean(v))} />
              <Label htmlFor="partyLoot" className="text-gray-300">Distribute for the party</Label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-gray-300">Exact Level Tables</Label>
            <div className="col-span-3 flex items-center space-x-2">
              <Checkbox id="exactLevel" checked={exactLevel} onCheckedChange={(v) => setExactLevel(Boolean(v))} />
              <Label htmlFor="exactLevel" className="text-gray-300">Use exact-level item counts if available</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>) : 'Generate Loot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Heart, Shield } from 'lucide-react'

type Combatant = { id: string; name: string; type: 'monster'|'pc'; hp?: number; ac?: number }
type InitiativeMap = Record<string, number>

export function InitiativeList({
  battle,
  onUpdateLocal,
}: {
  battle: any
  onUpdateLocal: (initiative: InitiativeMap, orderedIds: string[]) => void
}) {
  const base: Combatant[] = useMemo(() => {
    const parseNum = (v: any) => {
      if (typeof v === 'number') return v
      const m = String(v ?? '').match(/\d+/)
      return m ? Number(m[0]) : undefined
    }
    const mons = (Array.isArray(battle?.monsters) ? battle.monsters : []).map((m: any) => ({
      id: String(m.id || m.name),
      name: String(m.name || 'Monster'),
      type: 'monster' as const,
      hp: parseNum(m?.stats?.HP),
      ac: parseNum(m?.stats?.AC),
    }))
    const pcs = (Array.isArray(battle?.allies) ? battle.allies : []).map((p: any) => ({
      id: String(p.id || p.name),
      name: String(p.name || 'PC'),
      type: 'pc' as const,
      hp: parseNum(p?.stats?.HP),
      ac: parseNum(p?.stats?.AC),
    }))
    return [...mons, ...pcs]
  }, [battle])

  const defaultOrder = useMemo(() => base.map((c) => c.id), [base])

  const [initiative, setInitiative] = useState<InitiativeMap>({})
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [dragId, setDragId] = useState<string | null>(null)

  // Sync to battle prop (including when auto-roll updates happen)
  useEffect(() => {
    const fromBattle: InitiativeMap = { ...(battle?.initiative || {}) }
    setInitiative(fromBattle)
    const maybeOrder = Object.keys(fromBattle).length ? Object.keys(fromBattle) : defaultOrder
    setOrder(maybeOrder)
  }, [battle?.id, JSON.stringify(battle?.initiative), defaultOrder])

  const setInit = (id: string, val: number) => {
    const next = { ...initiative, [id]: val }
    setInitiative(next)
    onUpdateLocal(next, order)
  }

  const sortByInit = () => {
    const next = [...order].sort((a, b) => (initiative[b] || 0) - (initiative[a] || 0))
    setOrder(next)
    onUpdateLocal(initiative, next)
  }

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id)
    try { e.dataTransfer.setData('text/plain', id) } catch {}
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()
  const onDrop = (id: string) => {
    if (!dragId || dragId === id) return
    const from = order.indexOf(dragId)
    const to = order.indexOf(id)
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    setOrder(next)
    onUpdateLocal(initiative, next)
    setDragId(null)
  }

  const onSave = async () => {
    if (!battle?.id) return
    try {
      const res = await fetch(`/api/battles/${battle.id}/initiative`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiative, order }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Failed to save initiative')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">Initiative</Label>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="bg-gray-700 text-white" onClick={sortByInit}>Sort</Button>
          <Button variant="secondary" size="sm" className="bg-gray-700 text-white" onClick={onSave}>Save</Button>
        </div>
      </div>
      <div className="rounded border border-gray-700 divide-y divide-gray-700">
        {order.map((id) => {
          const c = base.find((x) => x.id === id)
          if (!c) return null
          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => onDragStart(e, id)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(id)}
              className={cn('flex items-center justify-between p-2 text-sm bg-gray-800 cursor-grab active:cursor-grabbing', dragId === id && 'opacity-70')}
              aria-label={`Drag to reorder ${c.name}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn('w-2 h-2 rounded-full', c.type === 'monster' ? 'bg-red-400' : 'bg-blue-400')} />
                <span className="truncate">{c.name}</span>
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-red-300" /> {Number.isFinite(c.hp) ? c.hp : '-'}</span>
                  <span className="inline-flex items-center gap-1"><Shield className="w-3 h-3 text-blue-300" /> {Number.isFinite(c.ac) ? c.ac : '-'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-20 h-8 bg-gray-700 border-gray-600 text-white"
                  value={Number.isFinite(initiative[id]) ? initiative[id] : 0}
                  onChange={(e) => setInit(id, parseInt(e.target.value || '0', 10) || 0)}
                  aria-label={`Initiative for ${c.name}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

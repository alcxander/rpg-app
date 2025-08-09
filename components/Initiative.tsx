"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { MapToken } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ChevronLeft, ChevronRight, Dice5, Save, Shuffle } from "lucide-react"
import { cn } from "@/lib/utils"

type Combatant = {
  id: string
  name: string
  type: "monster" | "pc"
  dexMod: number
}

type InitiativeMap = Record<string, number>

function parseNum(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const m = String(v ?? "").match(/-?\d+/)
  return m ? Number(m[0]) : undefined
}

function getDexMod(stats: any): number {
  // Try common keys: DEX_mod, DEX, Dex, dex
  const mod = parseNum(stats?.DEX_mod ?? stats?.Dex_mod ?? stats?.dex_mod)
  if (typeof mod === "number") return mod
  const dex = parseNum(stats?.DEX ?? stats?.Dex ?? stats?.dex)
  if (typeof dex === "number") {
    // 5e-style: mod = floor((DEX - 10)/2)
    return Math.floor((dex - 10) / 2)
  }
  return 0
}

function buildCombatants(battle: any): Combatant[] {
  if (!battle) return []
  const mons = (Array.isArray(battle?.monsters) ? battle.monsters : []).map((m: any) => ({
    id: String(m.id ?? m.name ?? crypto.randomUUID()),
    name: String(m.name ?? "Monster"),
    type: "monster" as const,
    dexMod: getDexMod(m?.stats ?? {}),
  }))
  const pcs = (Array.isArray(battle?.allies) ? battle.allies : []).map((p: any) => ({
    id: String(p.id ?? p.name ?? crypto.randomUUID()),
    name: String(p.name ?? "PC"),
    type: "pc" as const,
    dexMod: getDexMod(p?.stats ?? {}),
  }))
  return [...pcs, ...mons]
}

export default function Initiative({
  battle,
  tokens,
  onHighlightToken,
}: {
  battle: any | null
  tokens?: MapToken[]
  onHighlightToken?: (tokenId: string | null) => void
}) {
  const combatants = useMemo(() => buildCombatants(battle), [battle])

  // Initiative values and order
  const [initiative, setInitiative] = useState<InitiativeMap>({})
  const [order, setOrder] = useState<string[]>(combatants.map((c) => c.id))
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragId, setDragId] = useState<string | null>(null)

  // Initialize from battle or roll once if empty
  useEffect(() => {
    // Hydrate from battle.initiative if present
    const fromBattle: InitiativeMap = { ...(battle?.initiative || {}) }
    const hasAny = Object.keys(fromBattle).length > 0

    // Assign default ids and ensure all present
    const baseIds = combatants.map((c) => c.id)
    const initVals: InitiativeMap = {}
    baseIds.forEach((id) => {
      const existing = fromBattle[id]
      initVals[id] = typeof existing === "number" ? existing : Number.NaN
    })

    // If no existing values, auto-roll once
    if (!hasAny && baseIds.length) {
      const rolled: InitiativeMap = {}
      for (const c of combatants) {
        rolled[c.id] = rollInitiative(c.dexMod)
      }
      setInitiative(rolled)
      setOrder(baseIds)
      setActiveIdx(0)
      return
    }

    // If some are NaN (new arrivals), roll for just those
    const filled: InitiativeMap = { ...initVals }
    for (const c of combatants) {
      if (!Number.isFinite(filled[c.id])) {
        filled[c.id] = rollInitiative(c.dexMod)
      }
    }

    setInitiative(filled)
    // Preserve order from battle if it looks like an order array
    const maybeOrder =
      Array.isArray(battle?.initiativeOrder) && (battle.initiativeOrder as any[]).every((x) => typeof x === "string")
        ? (battle.initiativeOrder as string[])
        : baseIds
    // Ensure order contains only current ids and keeps their relative positions
    const idSet = new Set(baseIds)
    const pruned = maybeOrder.filter((id) => idSet.has(id))
    const missing = baseIds.filter((id) => !pruned.includes(id))
    setOrder([...pruned, ...missing])
    setActiveIdx(0)
  }, [battle?.id, JSON.stringify(battle?.initiative), combatants])

  // Highlight active or hovered token if available
  const idToTokenId = useMemo(() => {
    const map = new Map<string, string>()
    if (tokens && tokens.length) {
      // Try to map by id, else fallback by name
      for (const t of tokens) {
        map.set(t.id, t.id)
        map.set(`name:${t.name}`, t.id)
      }
    }
    return map
  }, [tokens])

  const hoverToken = useCallback(
    (combatantId: string | null) => {
      if (!onHighlightToken) return
      if (!combatantId) {
        onHighlightToken(null)
        return
      }
      // Match by id first
      const direct = idToTokenId.get(combatantId)
      if (direct) {
        onHighlightToken(direct)
        return
      }
      // Find by name fallback
      const c = combatants.find((x) => x.id === combatantId)
      if (c) {
        const byName = idToTokenId.get(`name:${c.name}`)
        onHighlightToken(byName ?? null)
      } else {
        onHighlightToken(null)
      }
    },
    [onHighlightToken, idToTokenId, combatants],
  )

  useEffect(() => {
    // Highlight current active on change
    hoverToken(order[activeIdx] || null)
    return () => hoverToken(null)
  }, [activeIdx, order, hoverToken])

  // Auto-roll function
  const rollInitiative = (dexMod: number) => {
    // Standard: d20 + dex mod
    return Math.floor(Math.random() * 20) + 1 + (Number.isFinite(dexMod) ? dexMod : 0)
  }

  // Actions
  const autoRollAll = () => {
    const next: InitiativeMap = {}
    for (const c of combatants) {
      next[c.id] = rollInitiative(c.dexMod)
    }
    setInitiative(next)
    // Keep existing order but you can sort after auto-roll
  }

  const sortByRoll = () => {
    const next = [...order].sort((a, b) => {
      const ai = initiative[a] ?? Number.NEGATIVE_INFINITY
      const bi = initiative[b] ?? Number.NEGATIVE_INFINITY
      if (bi !== ai) return bi - ai
      // tie-break by dex, then by name
      const ca = combatants.find((c) => c.id === a)
      const cb = combatants.find((c) => c.id === b)
      if ((cb?.dexMod ?? 0) !== (ca?.dexMod ?? 0)) return (cb?.dexMod ?? 0) - (ca?.dexMod ?? 0)
      return (ca?.name || "").localeCompare(cb?.name || "")
    })
    setOrder(next)
    setActiveIdx(0)
  }

  const setInit = (id: string, val: number) => {
    setInitiative((prev) => ({ ...prev, [id]: val }))
  }

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDragId(id)
    try {
      e.dataTransfer.setData("text/plain", id)
    } catch {}
    e.dataTransfer.effectAllowed = "move"
  }
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()
  const onDrop = (id: string) => {
    if (!dragId || dragId === id) return
    const from = order.indexOf(dragId)
    const to = order.indexOf(id)
    if (from === -1 || to === -1) return
    const next = [...order]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    setOrder(next)
    setDragId(null)
  }

  const onSave = async () => {
    if (!battle?.id) return
    try {
      const res = await fetch(`/api/battles/${battle.id}/initiative`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiative, order }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Failed to save initiative")
      }
    } catch (e) {
      console.error(e)
    }
  }

  const nextTurn = () => setActiveIdx((i) => (order.length ? (i + 1) % order.length : 0))
  const prevTurn = () => setActiveIdx((i) => (order.length ? (i - 1 + order.length) % order.length : 0))

  if (!battle) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-purple-400">Initiative</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-400">No active battle.</CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-800 border-gray-700 text-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-purple-400">Initiative</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-gray-700 text-white border-gray-600"
              onClick={prevTurn}
              title="Previous turn"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
              onClick={nextTurn}
              title="Next turn"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-gray-300">Turn Order</Label>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-700 text-white"
              onClick={autoRollAll}
              title="Auto roll D20 + Dex"
            >
              <Dice5 className="w-4 h-4 mr-1" />
              Auto Roll
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-700 text-white"
              onClick={sortByRoll}
              title="Sort by initiative"
            >
              <Shuffle className="w-4 h-4 mr-1" />
              Sort
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-gray-700 text-white"
              onClick={onSave}
              title="Save to battle"
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        <div className="rounded border border-gray-700 divide-y divide-gray-700">
          {order.map((id, index) => {
            const c = combatants.find((x) => x.id === id)
            if (!c) return null
            const active = index === activeIdx
            const val = Number.isFinite(initiative[id]) ? initiative[id] : 0
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => onDragStart(e, id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(id)}
                className={cn(
                  "flex items-center justify-between p-2 text-sm bg-gray-800 cursor-grab active:cursor-grabbing",
                  active ? "ring-1 ring-purple-500/60 bg-purple-900/10" : "",
                  dragId === id && "opacity-70",
                )}
                onMouseEnter={() => hoverToken(id)}
                onMouseLeave={() => hoverToken(order[activeIdx] || null)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("w-2 h-2 rounded-full", c.type === "monster" ? "bg-red-400" : "bg-blue-400")} />
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-gray-400">
                    DEX {c.dexMod >= 0 ? "+" : ""}
                    {c.dexMod}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Init</span>
                  <Input
                    type="number"
                    className="w-20 h-8 bg-gray-700 border-gray-600 text-white"
                    value={val}
                    onChange={(e) => setInit(id, Number.parseInt(e.target.value || "0", 10) || 0)}
                    aria-label={`Initiative for ${c.name}`}
                  />
                </div>
              </div>
            )
          })}
          {order.length === 0 && <div className="p-2 text-xs text-gray-400">No combatants</div>}
        </div>
      </CardContent>
    </Card>
  )
}

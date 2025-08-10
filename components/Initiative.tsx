"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  stats?: Record<string, any> | null
}

type InitiativeMap = Record<string, number>

type AbilityMods = {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}
type AbilityModsMap = Record<string, AbilityMods>

function parseNum(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const m = String(v ?? "").match(/-?\d+/)
  return m ? Number(m[0]) : undefined
}

function getDexModFromStats(stats: any): number | undefined {
  const mod =
    parseNum(stats?.DEX_mod) ??
    parseNum(stats?.Dex_mod) ??
    parseNum(stats?.dex_mod) ??
    parseNum(stats?.DexMod) ??
    parseNum(stats?.dexMod)
  if (typeof mod === "number") return mod
  const dex = parseNum(stats?.DEX) ?? parseNum(stats?.Dex) ?? parseNum(stats?.dex)
  if (typeof dex === "number") {
    return Math.floor((dex - 10) / 2)
  }
  return undefined
}

function getAbilityModsFromStats(stats: any): AbilityMods | undefined {
  if (!stats) return undefined
  // Accept raw ability or direct mods; normalize to mods
  const norm = (score: any, mod: any) => {
    const m = parseNum(mod)
    if (typeof m === "number") return m
    const s = parseNum(score)
    if (typeof s === "number") return Math.floor((s - 10) / 2)
    return undefined
  }
  const out: AbilityMods = {
    str: norm(stats?.STR ?? stats?.Str ?? stats?.str, stats?.STR_mod ?? stats?.Str_mod ?? stats?.str_mod) ?? 0,
    dex: norm(stats?.DEX ?? stats?.Dex ?? stats?.dex, stats?.DEX_mod ?? stats?.Dex_mod ?? stats?.dex_mod) ?? 0,
    con: norm(stats?.CON ?? stats?.Con ?? stats?.con, stats?.CON_mod ?? stats?.Con_mod ?? stats?.con_mod) ?? 0,
    int: norm(stats?.INT ?? stats?.Int ?? stats?.int, stats?.INT_mod ?? stats?.Int_mod ?? stats?.int_mod) ?? 0,
    wis: norm(stats?.WIS ?? stats?.Wis ?? stats?.wis, stats?.WIS_mod ?? stats?.Wis_mod ?? stats?.wis_mod) ?? 0,
    cha: norm(stats?.CHA ?? stats?.Cha ?? stats?.cha, stats?.CHA_mod ?? stats?.Cha_mod ?? stats?.cha_mod) ?? 0,
  }
  return out
}

// Weighted random for a typical low-level spread, favoring +1..+3
// Domain the user suggested: -1..+4; 1,2,3 more common
function sampleDexMod(): number {
  const buckets: Array<{ mod: number; w: number }> = [
    { mod: -1, w: 5 },
    { mod: 0, w: 12 },
    { mod: 1, w: 25 },
    { mod: 2, w: 28 },
    { mod: 3, w: 20 },
    { mod: 4, w: 10 },
  ]
  const total = buckets.reduce((a, b) => a + b.w, 0)
  let r = Math.random() * total
  for (const b of buckets) {
    if (r < b.w) return b.mod
    r -= b.w
  }
  return 1
}
// Sample the rest around zero with a mild bias to 0..+2
function sampleOtherMod(): number {
  const buckets: Array<{ mod: number; w: number }> = [
    { mod: -2, w: 5 },
    { mod: -1, w: 12 },
    { mod: 0, w: 28 },
    { mod: 1, w: 25 },
    { mod: 2, w: 20 },
    { mod: 3, w: 8 },
    { mod: 4, w: 2 },
  ]
  const total = buckets.reduce((a, b) => a + b.w, 0)
  let r = Math.random() * total
  for (const b of buckets) {
    if (r < b.w) return b.mod
    r -= b.w
  }
  return 0
}

function generateAbilityMods(): AbilityMods {
  return {
    str: sampleOtherMod(),
    dex: sampleDexMod(),
    con: sampleOtherMod(),
    int: sampleOtherMod(),
    wis: sampleOtherMod(),
    cha: sampleOtherMod(),
  }
}

function buildCombatants(battle: any): Combatant[] {
  if (!battle) return []
  const mons = (Array.isArray(battle?.monsters) ? battle.monsters : []).map((m: any) => ({
    id: String(m.id ?? m.name ?? crypto.randomUUID()),
    name: String(m.name ?? "Monster"),
    type: "monster" as const,
    stats: m?.stats ?? {},
  }))
  const pcs = (Array.isArray(battle?.allies) ? battle.allies : []).map((p: any) => ({
    id: String(p.id ?? p.name ?? crypto.randomUUID()),
    name: String(p.name ?? "PC"),
    type: "pc" as const,
    stats: p?.stats ?? {},
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

  // Stable generated ability mods per-combatant for this session
  const [abilityMods, setAbilityMods] = useState<AbilityModsMap>({})
  const seededRef = useRef(false)

  // Seed ability mods once per battle (or hydrate from stats if present)
  useEffect(() => {
    if (!combatants.length) {
      setAbilityMods({})
      seededRef.current = false
      return
    }
    const next: AbilityModsMap = {}
    for (const c of combatants) {
      const fromStats = getAbilityModsFromStats(c.stats)
      if (fromStats) {
        next[c.id] = fromStats
      } else {
        // Generate if not present
        next[c.id] = generateAbilityMods()
      }
    }
    setAbilityMods(next)
    seededRef.current = true
  }, [battle?.id, combatants])

  // Initiative values and order
  const [initiative, setInitiative] = useState<InitiativeMap>({})
  const [order, setOrder] = useState<string[]>(combatants.map((c) => c.id))
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragId, setDragId] = useState<string | null>(null)

  // Initialize from battle or roll once if empty/new
  useEffect(() => {
    const ids = combatants.map((c) => c.id)
    if (!ids.length) {
      setInitiative({})
      setOrder([])
      setActiveIdx(0)
      return
    }
    const fromBattle: InitiativeMap = { ...(battle?.initiative || {}) }
    const hasAny = Object.keys(fromBattle).length > 0
    const initVals: InitiativeMap = {}
    ids.forEach((id) => {
      const existing = fromBattle[id]
      initVals[id] = typeof existing === "number" ? existing : Number.NaN
    })

    // Roll for missing entries; if none exist, roll for all (once)
    const rolled: InitiativeMap = { ...initVals }
    for (const c of combatants) {
      if (!Number.isFinite(rolled[c.id])) {
        const dex = abilityMods[c.id]?.dex
        const dexMod = typeof dex === "number" ? dex : (getDexModFromStats(c.stats ?? {}) ?? 0)
        rolled[c.id] = rollInitiative(dexMod)
      }
    }
    setInitiative(rolled)

    // Order: hydrate, prune, then fill missing in list order
    const maybeOrder =
      Array.isArray(battle?.initiativeOrder) && (battle.initiativeOrder as any[]).every((x) => typeof x === "string")
        ? (battle.initiativeOrder as string[])
        : ids
    const idSet = new Set(ids)
    const pruned = maybeOrder.filter((id) => idSet.has(id))
    const missing = ids.filter((id) => !pruned.includes(id))
    setOrder([...pruned, ...missing])
    setActiveIdx(0)
  }, [battle?.id, JSON.stringify(battle?.initiative), combatants, abilityMods])

  // Map id->token id for highlight
  const idToTokenId = useMemo(() => {
    const map = new Map<string, string>()
    if (tokens && tokens.length) {
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
      const direct = idToTokenId.get(combatantId)
      if (direct) {
        onHighlightToken(direct)
        return
      }
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
    hoverToken(order[activeIdx] || null)
    return () => hoverToken(null)
  }, [activeIdx, order, hoverToken])

  // Standard d20 + dex mod
  const rollInitiative = (dexMod: number) => {
    return Math.floor(Math.random() * 20) + 1 + (Number.isFinite(dexMod) ? dexMod : 0)
  }

  // Actions
  const autoRollAll = () => {
    const next: InitiativeMap = {}
    for (const c of combatants) {
      const dex = abilityMods[c.id]?.dex
      const dexMod = typeof dex === "number" ? dex : (getDexModFromStats(c.stats ?? {}) ?? 0)
      next[c.id] = rollInitiative(dexMod)
    }
    setInitiative(next)
  }

  const sortByRoll = () => {
    const next = [...order].sort((a, b) => {
      const ai = initiative[a] ?? Number.NEGATIVE_INFINITY
      const bi = initiative[b] ?? Number.NEGATIVE_INFINITY
      if (bi !== ai) return bi - ai
      const da = abilityMods[a]?.dex ?? 0
      const db = abilityMods[b]?.dex ?? 0
      if (db !== da) return db - da
      const ca = combatants.find((c) => c.id === a)
      const cb = combatants.find((c) => c.id === b)
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-purple-400">Initiative</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-gray-300">Turn Order</Label>
          <div className="flex gap-2 flex-wrap">
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

        <div className="rounded border border-gray-700 divide-y divide-gray-700 max-w-full">
          {order.map((id, index) => {
            const c = combatants.find((x) => x.id === id)
            if (!c) return null
            const active = index === activeIdx
            const val = Number.isFinite(initiative[id]) ? initiative[id] : 0
            const mods = abilityMods[id] ?? {
              str: 0,
              dex: getDexModFromStats(c.stats ?? {}) ?? 0,
              con: 0,
              int: 0,
              wis: 0,
              cha: 0,
            }
            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => onDragStart(e, id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(id)}
                className={cn(
                  "flex flex-col gap-2 sm:items-center sm:justify-between p-2 text-sm bg-gray-800 cursor-grab active:cursor-grabbing sm:flex-col",
                  active ? "ring-1 ring-purple-500/60 bg-purple-900/10" : "",
                  dragId === id && "opacity-70",
                )}
                onMouseEnter={() => hoverToken(id)}
                onMouseLeave={() => hoverToken(order[activeIdx] || null)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn("w-2 h-2 rounded-full", c.type === "monster" ? "bg-red-400" : "bg-blue-400")} />
                  <span className="truncate max-w-[12rem]">{c.name}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap underline">
                    DEX {mods.dex >= 0 ? "+" : ""}
                    {mods.dex}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 sm:gap-2">
                  <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
                    <span>
                      STR {mods.str >= 0 ? "+" : ""}
                      {mods.str}
                    </span>
                    <span>
                      DEX {mods.dex >= 0 ? "+" : ""}
                      {mods.dex}
                    </span>
                    <span>
                      CON {mods.con >= 0 ? "+" : ""}
                      {mods.con}
                    </span>
                    <span>
                      INT {mods.int >= 0 ? "+" : ""}
                      {mods.int}
                    </span>
                    <span>
                      WIS {mods.wis >= 0 ? "+" : ""}
                      {mods.wis}
                    </span>
                    <span>
                      CHA {mods.cha >= 0 ? "+" : ""}
                      {mods.cha}
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
              </div>
            )
          })}
          {order.length === 0 && <div className="p-2 text-xs text-gray-400">No combatants</div>}
        </div>
      </CardContent>
    </Card>
  )
}

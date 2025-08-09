"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Coins, FlaskConical, Scroll, Package, Shield, Sword, Copy, Wand2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type LootFormProps = {
  sessionId: string | null
}

type LootResult = {
  summary?: string
  coins?: { cp?: number; sp?: number; gp?: number; pp?: number }
  trinkets?: { name: string; qty: number; note?: string }[]
  consumables?: { name: string; qty: number; rarity?: string; note?: string }[]
  scrolls?: { name: string; qty: number; rarity?: string; note?: string }[]
  weapons_gear?: { name: string; qty: number; rarity?: string; note?: string }[]
  adventuring_gear?: { name: string; qty: number; note?: string }[]
}

export default function LootForm({ sessionId }: LootFormProps) {
  const [useMapContext, setUseMapContext] = useState(true)
  const [partyLevel, setPartyLevel] = useState<number>(3)
  const [partySize, setPartySize] = useState<number>(4)
  const [difficulty, setDifficulty] = useState<string>("Medium")
  const [rarityPreference, setRarityPreference] = useState<"auto" | "low" | "mid" | "high">("auto")
  const [partyLoot, setPartyLoot] = useState(false)
  const [exactLevel, setExactLevel] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<LootResult | null>(null)
  const { toast } = useToast()

  const onGenerate = async () => {
    setIsLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/generate-loot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          useMapContext,
          partyLevel,
          partySize,
          difficulty,
          rarityPreference,
          partyLoot,
          exactLevel,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error || "Failed to generate loot")
      }
      setResult(body.loot || null)
    } catch (e: any) {
      toast({
        title: "Loot generation failed",
        description: e.message || "Unknown error",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!result) return
    const lines: string[] = []
    if (result.summary) lines.push(`Summary: ${result.summary}`)
    if (result.coins) {
      const { cp = 0, sp = 0, gp = 0, pp = 0 } = result.coins
      lines.push(`Coins: ${cp}cp, ${sp}sp, ${gp}gp, ${pp}pp`)
    }
    const block = (title: string, items?: any[]) => {
      if (!items || !items.length) return
      lines.push(`${title}:`)
      for (const it of items) {
        const qty = it.qty ?? 1
        const parts = [it.name, `(x${qty})`, it.rarity ? `[${it.rarity}]` : "", it.note ? `- ${it.note}` : ""]
        lines.push(`- ${parts.filter(Boolean).join(" ")}`)
      }
    }
    block("Trinkets", result.trinkets)
    block("Consumables", result.consumables)
    block("Scrolls", result.scrolls)
    block("Weapons/Gear", result.weapons_gear)
    block("Adventuring Gear", result.adventuring_gear)

    await navigator.clipboard.writeText(lines.join("\n"))
    toast({ title: "Copied to clipboard", className: "bg-green-600 text-white" })
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="text-purple-400">Generate Loot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between space-x-2 p-2 rounded bg-gray-700/50">
              <Label htmlFor="useMap">Use Map Context</Label>
              <Switch id="useMap" checked={useMapContext} onCheckedChange={setUseMapContext} />
            </div>
            <div className="flex items-center justify-between space-x-2 p-2 rounded bg-gray-700/50">
              <Label htmlFor="partyLoot">Party Loot (Xanathar's)</Label>
              <Switch id="partyLoot" checked={partyLoot} onCheckedChange={setPartyLoot} />
            </div>
            <div className="flex items-center justify-between space-x-2 p-2 rounded bg-gray-700/50">
              <Label htmlFor="exactLevel">Exact Level</Label>
              <Switch id="exactLevel" checked={exactLevel} onCheckedChange={setExactLevel} />
            </div>

            <div>
              <Label className="text-gray-300">Party Level</Label>
              <Input
                type="number"
                value={partyLevel}
                onChange={(e) => setPartyLevel(Number.parseInt(e.target.value || "0", 10))}
                className="bg-gray-700 border-gray-600 text-white"
                min={1}
                max={20}
              />
            </div>
            <div>
              <Label className="text-gray-300">Party Size</Label>
              <Input
                type="number"
                value={partySize}
                onChange={(e) => setPartySize(Number.parseInt(e.target.value || "0", 10))}
                className="bg-gray-700 border-gray-600 text-white"
                min={1}
                max={10}
              />
            </div>
            <div>
              <Label className="text-gray-300">Difficulty / CR</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                  <SelectItem value="Deadly">Deadly</SelectItem>
                  <SelectItem value="CR 1">CR 1</SelectItem>
                  <SelectItem value="CR 5">CR 5</SelectItem>
                  <SelectItem value="CR 10">CR 10</SelectItem>
                  <SelectItem value="CR 15">CR 15</SelectItem>
                  <SelectItem value="CR 20">CR 20</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Rarity Preference</Label>
              <Select value={rarityPreference} onValueChange={(v: any) => setRarityPreference(v)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="auto" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="low">Bias Lower</SelectItem>
                  <SelectItem value="mid">Balanced</SelectItem>
                  <SelectItem value="high">Bias Higher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={onGenerate} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...
                </>
              ) : (
                <>
                  Generate <Wand2 className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              disabled={!result}
              className="bg-gray-700 text-white border-gray-600"
            >
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-gray-800 border-gray-700 text-white">
          <CardHeader>
            <CardTitle className="text-purple-400">Loot Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.summary && <p className="text-gray-300">{result.summary}</p>}

            {result.coins && (
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-300" />
                <span className="tabular-nums">
                  {result.coins.cp || 0}cp · {result.coins.sp || 0}sp · {result.coins.gp || 0}gp ·{" "}
                  {result.coins.pp || 0}pp
                </span>
              </div>
            )}

            <Section icon={<Package className="w-4 h-4 text-gray-200" />} title="Trinkets" items={result.trinkets} />
            <Section
              icon={<FlaskConical className="w-4 h-4 text-red-300" />}
              title="Consumables"
              items={result.consumables}
            />
            <Section icon={<Scroll className="w-4 h-4 text-emerald-300" />} title="Scrolls" items={result.scrolls} />
            <Section
              icon={<Sword className="w-4 h-4 text-indigo-300" />}
              title="Weapons / Gear"
              items={result.weapons_gear}
            />
            <Section
              icon={<Shield className="w-4 h-4 text-blue-300" />}
              title="Adventuring Gear"
              items={result.adventuring_gear}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Section({ title, items, icon }: { title: string; items?: any[]; icon: React.ReactNode }) {
  if (!items || !items.length) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-semibold text-gray-200">{title}</span>
        <Badge className="ml-2 bg-gray-700 border-gray-600 text-gray-200">{items.length}</Badge>
      </div>
      <ul className="space-y-1">
        {items.map((it, idx) => (
          <li key={idx} className="flex justify-between bg-gray-700/40 rounded px-2 py-1">
            <span className="truncate">
              {it.name}
              {it.rarity && <span className="ml-2 text-xs text-gray-300">[{it.rarity}]</span>}
              {it.note && <span className="ml-2 text-xs text-gray-400">— {it.note}</span>}
            </span>
            <span className="tabular-nums text-gray-200">x{it.qty ?? 1}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import type { MapToken } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  tokens: MapToken[]
  onHighlightToken?: (id: string | null) => void
}

export default function Initiative({ tokens, onHighlightToken }: Props) {
  const defaultOrder = useMemo(() => {
    const pcs = tokens.filter((t) => t.type === "pc").sort((a, b) => a.name.localeCompare(b.name))
    const mons = tokens.filter((t) => t.type === "monster").sort((a, b) => a.name.localeCompare(b.name))
    return [...pcs, ...mons].map((t) => t.id)
  }, [tokens])

  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [idx, setIdx] = useState(0)

  // Keep order in sync with token changes (preserve existing when possible)
  useEffect(() => {
    const setIds = new Set(tokens.map((t) => t.id))
    const filtered = order.filter((id) => setIds.has(id))
    const missing = defaultOrder.filter((id) => !filtered.includes(id))
    const next = [...filtered, ...missing]
    setOrder(next)
    if (idx >= next.length) setIdx(0)
  }, [tokens, defaultOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onHighlightToken?.(order[idx] || null)
    return () => onHighlightToken?.(null)
  }, [idx, order, onHighlightToken])

  const advance = () => setIdx((i) => (order.length ? (i + 1) % order.length : 0))
  const back = () => setIdx((i) => (order.length ? (i - 1 + order.length) % order.length : 0))
  const reset = () => setIdx(0)

  return (
    <Card className="bg-gray-800 border-gray-700 text-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-purple-400">Initiative</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="bg-gray-700 text-white border-gray-600" onClick={back}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white" size="sm" onClick={advance}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="secondary" className="bg-gray-700 text-white border-gray-600" onClick={reset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
        <ol className="space-y-1">
          {order.map((id, i) => {
            const t = tokens.find((x) => x.id === id)
            if (!t) return null
            const active = i === idx
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center justify-between text-sm px-2 py-1 rounded cursor-pointer",
                  active ? "bg-purple-600/30 text-purple-100" : "bg-gray-700/40 text-gray-200",
                )}
                onClick={() => setIdx(i)}
                onMouseEnter={() => onHighlightToken?.(id)}
                onMouseLeave={() => onHighlightToken?.(order[idx] || null)}
              >
                <span className="truncate">{t.name}</span>
                <span className="text-xs opacity-80">{t.type.toUpperCase()}</span>
              </li>
            )
          })}
          {order.length === 0 && <li className="text-xs text-gray-400">No tokens</li>}
        </ol>
      </CardContent>
    </Card>
  )
}

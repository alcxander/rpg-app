"use client"

import type { MapToken } from "@/lib/types"
import { Heart, Shield, SwordIcon, User2, Info } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

type Props = {
  monsters: MapToken[]
  pcs: MapToken[]
  onHoverToken?: (id: string | null) => void
}

function extractNotes(stats: Record<string, any> | undefined) {
  if (!stats) return null
  return stats.notes || stats.Notes || stats.description || stats.Description || stats.traits || stats.Traits || null
}

function MiniRow({ t, onHover }: { t: MapToken; onHover?: (id: string | null) => void }) {
  const hp = typeof t.stats?.HP === "number" ? t.stats.HP : Number(String(t.stats?.HP || "").match(/\d+/)?.[0] || 0)
  const ac = typeof t.stats?.AC === "number" ? t.stats.AC : Number(String(t.stats?.AC || "").match(/\d+/)?.[0] || 0)
  const notes = extractNotes(t.stats)

  const row = (
    <div
      className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-gray-700 cursor-pointer"
      onMouseEnter={() => onHover?.(t.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onHover?.(t.id)}
      title="Highlight on map"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("w-2 h-2 rounded-full", t.type === "monster" ? "bg-red-400" : "bg-blue-400")} />
        <span className="truncate">{t.name}</span>
      </div>
      <div className="flex items-center gap-3 text-gray-300 flex-shrink-0">
        <span className="inline-flex items-center gap-1">
          <Heart className="w-3 h-3 text-red-300" />
          <span className="tabular-nums">{hp || "-"}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Shield className="w-3 h-3 text-blue-300" />
          <span className="tabular-nums">{ac || "-"}</span>
        </span>
        {notes && <Info className="w-3 h-3 text-purple-300" />}
      </div>
    </div>
  )

  if (!notes) return row

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div>{row}</div>
      </HoverCardTrigger>
      <HoverCardContent className="bg-gray-800 text-gray-100 border-gray-700 max-w-sm">
        <div className="text-xs leading-relaxed space-y-2">
          <div className="font-semibold text-purple-300">{t.name}</div>
          <pre className="whitespace-pre-wrap break-words">
            {typeof notes === "string" ? notes : JSON.stringify(notes, null, 2)}
          </pre>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function TokenList({ monsters, pcs, onHoverToken }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
          <SwordIcon className="w-4 h-4 text-red-300" />
          <span>Monsters</span>
          <span className="ml-auto text-xs text-gray-400">{monsters.length}</span>
        </div>
        <div className="rounded border border-gray-700 divide-y divide-gray-700">
          {monsters.length ? (
            monsters.map((t) => <MiniRow key={t.id} t={t} onHover={onHoverToken} />)
          ) : (
            <div className="text-xs text-gray-500 p-2">No monsters</div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
          <User2 className="w-4 h-4 text-blue-300" />
          <span>Player Characters</span>
          <span className="ml-auto text-xs text-gray-400">{pcs.length}</span>
        </div>
        <div className="rounded border border-gray-700 divide-y divide-gray-700">
          {pcs.length ? (
            pcs.map((t) => <MiniRow key={t.id} t={t} onHover={onHoverToken} />)
          ) : (
            <div className="text-xs text-gray-500 p-2">No PCs</div>
          )}
        </div>
      </div>
    </div>
  )
}

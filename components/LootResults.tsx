'use client'

import { Coins, Gem, FlaskRound, Shield, Swords } from 'lucide-react'

export function LootResults({ result }: { result: any }) {
  if (!result) return null
  const loot = Array.isArray(result?.loot) ? result.loot : result?.data?.loot || []
  const sizeScore = loot.length + Math.min(1000, (loot.find((x: any) => x.type === 'coin')?.amount || 0)) / 250
  const sizeLabel = sizeScore > 8 ? 'Bountiful' : sizeScore > 4 ? 'Solid' : 'Meager'

  const iconFor = (item: any) => {
    switch (item.type) {
      case 'coin': return <Coins className="w-4 h-4 text-yellow-300" />
      case 'trinket': return <Gem className="w-4 h-4 text-purple-300" />
      case 'consumable': return <FlaskRound className="w-4 h-4 text-green-300" />
      case 'gear': return <Shield className="w-4 h-4 text-blue-300" />
      default: return <Swords className="w-4 h-4 text-gray-300" />
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-300">Loot Result</div>
        <div className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200">{sizeLabel}</div>
      </div>
      <ul className="space-y-2">
        {loot.map((item: any, idx: number) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <div className="mt-0.5">{iconFor(item)}</div>
            <div className="text-gray-200">
              {item.type === 'coin' ? (
                <span>{item.amount} {item.currency?.toUpperCase?.() || 'GP'}</span>
              ) : (
                <span>{item.name || item.type}</span>
              )}
              {item.rarity && <span className="ml-2 text-xs text-gray-400">({item.rarity})</span>}
            </div>
          </li>
        ))}
      </ul>
      {result?.references && (
        <div className="mt-3">
          <div className="text-xs text-gray-400 mb-1">References</div>
          <ul className="text-xs text-gray-400 list-disc pl-5 space-y-1">
            {result.references.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

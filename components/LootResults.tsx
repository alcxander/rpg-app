"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Coins } from "lucide-react"
import type { LootResult } from "@/types"

interface LootResultsProps {
  results: LootResult[]
}

export default function LootResults({ results }: LootResultsProps) {
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Loot</CardTitle>
          <CardDescription>Generated treasure will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No loot generated yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Recent Loot
        </CardTitle>
        <CardDescription>Latest generated treasure</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-4">
            {results.map((result) => (
              <div key={result.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">Treasure #{result.id.slice(-6)}</h4>
                  <span className="text-xs text-muted-foreground">
                    {new Date(result.generated_at).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2">
                  {result.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.rarity}</Badge>
                        <span className="text-sm">×{item.quantity}</span>
                        <span className="text-sm font-medium">{item.value}gp</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

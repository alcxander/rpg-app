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
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No loot generated yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const latestResult = results[results.length - 1]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Loot</CardTitle>
        <CardDescription>Most recently generated treasure</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {latestResult.items.map((item, index) => (
              <div key={index} className="p-3 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{item.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.rarity === "Legendary"
                          ? "destructive"
                          : item.rarity === "Rare"
                            ? "default"
                            : item.rarity === "Uncommon"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {item.rarity}
                    </Badge>
                    <span className="text-sm font-medium text-yellow-600">{item.value} gp</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                {item.quantity > 1 && <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

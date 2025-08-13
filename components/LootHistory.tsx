"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { History } from "lucide-react"
import type { LootResult } from "@/types"

interface LootHistoryProps {
  sessionId: string
}

export default function LootHistory({ sessionId }: LootHistoryProps) {
  const [history, setHistory] = useState<LootResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/loot-history?sessionId=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setHistory(data.history || [])
        }
      } catch (error) {
        console.error("Failed to load loot history:", error)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      loadHistory()
    }
  }, [sessionId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Loot History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Loot History
        </CardTitle>
        <CardDescription>All treasure generated for this session</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No loot history yet</p>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {history.map((result) => (
                <div key={result.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{new Date(result.generated_at).toLocaleDateString()}</span>
                    <Badge variant="outline">{result.items.length} items</Badge>
                  </div>
                  <div className="space-y-1">
                    {result.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        {item.name} ({item.rarity})
                      </div>
                    ))}
                    {result.items.length > 3 && (
                      <div className="text-xs text-muted-foreground">+{result.items.length - 3} more items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"
import type { LootResult } from "@/types"

interface LootHistoryProps {
  sessionId: string
}

export default function LootHistory({ sessionId }: LootHistoryProps) {
  const [history, setHistory] = useState<LootResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const loadHistory = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/loot/history?sessionId=${sessionId}`)
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

    loadHistory()
  }, [sessionId])

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
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading history...</p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No loot history for this session</p>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {history.map((result) => (
                <div key={result.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{new Date(result.generated_at).toLocaleDateString()}</span>
                    <Badge variant="secondary">{result.items.length} items</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {result.items.slice(0, 3).map((item, index) => (
                      <span key={index}>
                        {item.name}
                        {index < Math.min(2, result.items.length - 1) ? ", " : ""}
                      </span>
                    ))}
                    {result.items.length > 3 && "..."}
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

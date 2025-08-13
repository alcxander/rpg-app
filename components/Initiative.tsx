"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, ArrowUp, ArrowDown } from "lucide-react"
import type { BattleEntity } from "@/types"

interface InitiativeProps {
  sessionId: string
  battleId: string | null
}

export default function Initiative({ sessionId, battleId }: InitiativeProps) {
  const [entities, setEntities] = useState<BattleEntity[]>([])
  const [currentTurn, setCurrentTurn] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (battleId) {
      loadInitiative()
    }
  }, [battleId])

  const loadInitiative = async () => {
    if (!battleId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/battles/${battleId}/initiative`)
      if (response.ok) {
        const data = await response.json()
        setEntities(data.entities || [])
        setCurrentTurn(data.currentTurn || 0)
      }
    } catch (error) {
      console.error("Failed to load initiative:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateInitiative = async (entityId: string, initiative: number) => {
    if (!battleId) return

    try {
      const response = await fetch(`/api/battles/${battleId}/initiative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, initiative }),
      })

      if (response.ok) {
        await loadInitiative()
      }
    } catch (error) {
      console.error("Failed to update initiative:", error)
    }
  }

  const nextTurn = () => {
    setCurrentTurn((prev) => (prev + 1) % entities.length)
  }

  const previousTurn = () => {
    setCurrentTurn((prev) => (prev - 1 + entities.length) % entities.length)
  }

  if (!battleId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Initiative Tracker
          </CardTitle>
          <CardDescription>Select a battle to track initiative</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No battle selected</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Initiative Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  const sortedEntities = [...entities].sort((a, b) => b.initiative_order - a.initiative_order)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Initiative Tracker
        </CardTitle>
        <CardDescription>Track turn order and combat flow</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button onClick={previousTurn} variant="outline" size="sm">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button onClick={nextTurn} variant="outline" size="sm">
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-2">
            {sortedEntities.map((entity, index) => (
              <div
                key={entity.id}
                className={`p-3 rounded-lg border ${index === currentTurn ? "bg-primary/10 border-primary" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge variant={entity.type === "ally" ? "default" : "destructive"}>{entity.type}</Badge>
                    <span className="font-medium">{entity.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      HP: {entity.hp}/{entity.max_hp}
                    </span>
                    <Input
                      type="number"
                      value={entity.initiative_order}
                      onChange={(e) => updateInitiative(entity.id, Number.parseInt(e.target.value))}
                      className="w-16 h-8"
                      min="0"
                      max="30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

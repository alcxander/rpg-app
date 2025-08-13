"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, Plus, Minus, RotateCcw } from "lucide-react"
import type { BattleEntity } from "@/types"

interface InitiativeProps {
  sessionId: string
  battleId: string | null
}

export default function Initiative({ sessionId, battleId }: InitiativeProps) {
  const [entities, setEntities] = useState<BattleEntity[]>([])
  const [currentTurn, setCurrentTurn] = useState(0)
  const [round, setRound] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!battleId) return

    const loadEntities = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/battles/${battleId}/entities`)
        if (response.ok) {
          const data = await response.json()
          const sortedEntities = (data.entities || []).sort(
            (a: BattleEntity, b: BattleEntity) => b.initiative_order - a.initiative_order,
          )
          setEntities(sortedEntities)
        }
      } catch (error) {
        console.error("Failed to load entities:", error)
      } finally {
        setLoading(false)
      }
    }

    loadEntities()
  }, [battleId])

  const nextTurn = () => {
    if (entities.length === 0) return

    const nextIndex = (currentTurn + 1) % entities.length
    setCurrentTurn(nextIndex)

    if (nextIndex === 0) {
      setRound((prev) => prev + 1)
    }
  }

  const previousTurn = () => {
    if (entities.length === 0) return

    const prevIndex = currentTurn === 0 ? entities.length - 1 : currentTurn - 1
    setCurrentTurn(prevIndex)

    if (currentTurn === 0) {
      setRound((prev) => Math.max(1, prev - 1))
    }
  }

  const resetInitiative = () => {
    setCurrentTurn(0)
    setRound(1)
  }

  const updateHP = async (entityId: string, newHP: number) => {
    try {
      const response = await fetch(`/api/battles/${battleId}/entities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, hp: newHP }),
      })

      if (response.ok) {
        setEntities((prev) => prev.map((entity) => (entity.id === entityId ? { ...entity, hp: newHP } : entity)))
      }
    } catch (error) {
      console.error("Failed to update HP:", error)
    }
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
          <p className="text-muted-foreground text-center py-8">No active battle selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Initiative Tracker
        </CardTitle>
        <CardDescription>Round {round} - Track turn order and health</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button size="sm" onClick={previousTurn} disabled={entities.length === 0}>
              <Minus className="h-4 w-4" />
              Previous
            </Button>
            <Button size="sm" onClick={nextTurn} disabled={entities.length === 0}>
              Next
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={resetInitiative}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading entities...</p>
          ) : entities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No entities in this battle</p>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {entities.map((entity, index) => (
                  <div
                    key={entity.id}
                    className={`p-3 rounded-lg border ${
                      index === currentTurn ? "bg-primary/10 border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={entity.type === "monster" ? "destructive" : "default"}>
                          {entity.initiative_order}
                        </Badge>
                        <div>
                          <h4 className="font-medium">{entity.name}</h4>
                          <p className="text-sm text-muted-foreground">AC {entity.ac}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={entity.hp}
                          onChange={(e) => updateHP(entity.id, Number.parseInt(e.target.value))}
                          className="w-16 h-8"
                          min="0"
                        />
                        <span className="text-sm text-muted-foreground">/ {entity.max_hp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { BattleEntity } from "@/types"

interface StatBlockProps {
  creature: BattleEntity
}

export default function StatBlock({ creature }: StatBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {creature.name}
          <Badge variant={creature.type === "monster" ? "destructive" : "default"}>{creature.type}</Badge>
        </CardTitle>
        <CardDescription>Combat Statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{creature.hp}</div>
            <div className="text-sm text-muted-foreground">Hit Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{creature.ac}</div>
            <div className="text-sm text-muted-foreground">Armor Class</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{creature.initiative_order}</div>
            <div className="text-sm text-muted-foreground">Initiative</div>
          </div>
        </div>

        <Separator />

        {creature.stats && Object.keys(creature.stats).length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Additional Stats</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(creature.stats).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace("_", " ")}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

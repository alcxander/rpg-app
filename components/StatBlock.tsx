"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { BattleEntity } from "@/types"

interface StatBlockProps {
  creature: BattleEntity
}

export default function StatBlock({ creature }: StatBlockProps) {
  const stats = creature.stats || {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {creature.name}
          <Badge variant={creature.type === "ally" ? "default" : "destructive"}>{creature.type}</Badge>
        </CardTitle>
        <CardDescription>Combat Statistics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium">Hit Points</div>
            <div className="text-lg">
              {creature.hp}/{creature.max_hp}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Armor Class</div>
            <div className="text-lg">{creature.ac}</div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium">STR</div>
            <div className="text-center">{stats.strength || 10}</div>
          </div>
          <div>
            <div className="text-sm font-medium">DEX</div>
            <div className="text-center">{stats.dexterity || 10}</div>
          </div>
          <div>
            <div className="text-sm font-medium">CON</div>
            <div className="text-center">{stats.constitution || 10}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm font-medium">INT</div>
            <div className="text-center">{stats.intelligence || 10}</div>
          </div>
          <div>
            <div className="text-sm font-medium">WIS</div>
            <div className="text-center">{stats.wisdom || 10}</div>
          </div>
          <div>
            <div className="text-sm font-medium">CHA</div>
            <div className="text-center">{stats.charisma || 10}</div>
          </div>
        </div>

        {stats.actions && (
          <>
            <Separator />
            <div>
              <div className="text-sm font-medium mb-2">Actions</div>
              <div className="space-y-2">
                {stats.actions.map((action: any, index: number) => (
                  <div key={index} className="text-sm">
                    <div className="font-medium">{action.name}</div>
                    <div className="text-muted-foreground">{action.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye } from "lucide-react"
import type { BattleEntity } from "@/types"

interface TokenListProps {
  tokens: BattleEntity[]
  onTokenClick: (token: BattleEntity) => void
  title: string
  filter: (token: BattleEntity) => boolean
}

export default function TokenList({ tokens, onTokenClick, title, filter }: TokenListProps) {
  const filteredTokens = tokens.filter(filter)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{filteredTokens.length} entities</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {filteredTokens.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No {title.toLowerCase()} in this battle</p>
            ) : (
              filteredTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{token.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        HP: {token.hp}/{token.max_hp}
                      </span>
                      <span>AC: {token.ac}</span>
                      <Badge variant="outline" className="text-xs">
                        Init: {token.initiative_order}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onTokenClick(token)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

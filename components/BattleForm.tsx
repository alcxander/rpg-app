"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Sword } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Battle } from "@/types"

interface BattleFormProps {
  sessionId: string
  onBattleGenerated: (battle: Battle) => void
  isGenerating: boolean
  setIsGenerating: (generating: boolean) => void
}

export default function BattleForm({ sessionId, onBattleGenerated, isGenerating, setIsGenerating }: BattleFormProps) {
  const [partyLevel, setPartyLevel] = useState(3)
  const [partySize, setPartySize] = useState(4)
  const [challengeRating, setChallengeRating] = useState("Medium")
  const [locationTheme, setLocationTheme] = useState("Forest")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          partyLevel,
          partySize,
          challengeRating,
          locationTheme,
          additionalNotes: additionalNotes || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate battle")
      }

      const data = await response.json()
      onBattleGenerated(data.battle)

      toast({
        title: "Battle Generated!",
        description: "The new battle scenario has been created.",
        className: "bg-green-600 text-white",
      })

      // Reset form
      setAdditionalNotes("")
    } catch (error: any) {
      console.error("Failed to generate battle:", error)
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate battle. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sword className="h-5 w-5" />
          Generate Battle
        </CardTitle>
        <CardDescription>Create a new battle encounter for your session</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="partyLevel">Party Level</Label>
              <Input
                id="partyLevel"
                type="number"
                value={partyLevel}
                onChange={(e) => setPartyLevel(Number.parseInt(e.target.value))}
                min="1"
                max="20"
              />
            </div>
            <div>
              <Label htmlFor="partySize">Party Size</Label>
              <Input
                id="partySize"
                type="number"
                value={partySize}
                onChange={(e) => setPartySize(Number.parseInt(e.target.value))}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="challengeRating">Challenge Rating</Label>
            <Select value={challengeRating} onValueChange={setChallengeRating}>
              <SelectTrigger>
                <SelectValue placeholder="Select a rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
                <SelectItem value="Deadly">Deadly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="locationTheme">Location Theme</Label>
            <Input
              id="locationTheme"
              value={locationTheme}
              onChange={(e) => setLocationTheme(e.target.value)}
              placeholder="e.g., Forest, Dungeon, City Market"
            />
          </div>

          <div>
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Any specific monsters, objectives, or environmental hazards?"
            />
          </div>

          <Button type="submit" disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Battle"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Dice6 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { LootResult } from "@/types"

interface LootFormProps {
  onLootGenerated: (result: LootResult) => void
  isGenerating: boolean
  setIsGenerating: (generating: boolean) => void
}

export default function LootForm({ onLootGenerated, isGenerating, setIsGenerating }: LootFormProps) {
  const [partyLevel, setPartyLevel] = useState(3)
  const [encounterDifficulty, setEncounterDifficulty] = useState("Medium")
  const [lootType, setLootType] = useState("Treasure Hoard")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-loot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyLevel,
          encounterDifficulty,
          lootType,
          additionalNotes: additionalNotes || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate loot")
      }

      const data = await response.json()
      onLootGenerated(data.loot)

      toast({
        title: "Loot Generated!",
        description: "New treasure has been added to your collection.",
        className: "bg-green-600 text-white",
      })

      // Reset form
      setAdditionalNotes("")
    } catch (error: any) {
      console.error("Failed to generate loot:", error)
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate loot. Please try again.",
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
          <Dice6 className="h-5 w-5" />
          Generate Loot
        </CardTitle>
        <CardDescription>Create treasure rewards for your party</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="encounterDifficulty">Encounter Difficulty</Label>
            <Select value={encounterDifficulty} onValueChange={setEncounterDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Select difficulty" />
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
            <Label htmlFor="lootType">Loot Type</Label>
            <Select value={lootType} onValueChange={setLootType}>
              <SelectTrigger>
                <SelectValue placeholder="Select loot type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual Treasure">Individual Treasure</SelectItem>
                <SelectItem value="Treasure Hoard">Treasure Hoard</SelectItem>
                <SelectItem value="Magic Items">Magic Items</SelectItem>
                <SelectItem value="Coins Only">Coins Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="additionalNotes">Additional Notes</Label>
            <Textarea
              id="additionalNotes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Any specific items or treasure themes?"
            />
          </div>

          <Button type="submit" disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Loot"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

"use client"

import { useEffect } from "react"

import { useCallback } from "react"

import { useMemo } from "react"

import { useState } from "react"

import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Sword, Shield, Users, MapPin, Dice6, Plus } from "lucide-react"

import BattleForm from "@/components/BattleForm"
import LootForm from "@/components/LootForm"
import LootResults from "@/components/LootResults"
import LootHistory from "@/components/LootHistory"
import CanvasMap from "@/components/CanvasMap"
import Initiative from "@/components/Initiative"
import ChatMessages from "@/components/ChatMessages"
import TokenList from "@/components/TokenList"
import StatBlock from "@/components/StatBlock"

import { useSessionChat } from "@/hooks/useSessionChat"
import { useRealtimeSession } from "@/hooks/useRealtimeSession"

import type { Battle, LootResult, MapToken } from "@/types"

interface Campaign {
  id: string
  name: string
  owner_id: string
  is_owner: boolean
  is_member: boolean
  member_role: string | null
}

export default function HomePage() {
  const { user } = useUser()
  const { toast } = useToast()

  // State management
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [battles, setBattles] = useState<Battle[]>([])
  const [selectedBattle, setSelectedBattle] = useState<string>("")
  const [lootResults, setLootResults] = useState<LootResult[]>([])
  const [isGeneratingBattle, setIsGeneratingBattle] = useState(false)
  const [isGeneratingLoot, setIsGeneratingLoot] = useState(false)
  const [showStatBlock, setShowStatBlock] = useState(false)
  const [selectedCreature, setSelectedCreature] = useState<any>(null)

  // Session state from realtime hook
  const { sessionState, updateSessionState } = useRealtimeSession(selectedSession)

  // Chat functionality
  const { messages, sendMessage, isLoading: isChatLoading } = useSessionChat(selectedSession)

  // Memoized map data with null safety
  const memoMap = useMemo(() => sessionState?.map ?? null, [sessionState?.map])

  // Convert a battle's monsters/allies into MapToken[] snapshot
  const tokensFromBattle = useCallback((battle: any): MapToken[] => {
    if (!battle?.entities) return []

    return battle.entities.map((entity: any, index: number) => ({
      id: `${entity.name}-${index}`,
      name: entity.name,
      x: 100 + index * 60,
      y: 100,
      imageUrl: entity.token_image || "/placeholder.svg?height=50&width=50",
      isPlayer: entity.type === "ally",
      hp: entity.hp,
      maxHp: entity.max_hp || entity.hp,
      ac: entity.ac,
      initiativeOrder: entity.initiative_order || 0,
    }))
  }, [])

  // Load campaigns on mount
  useEffect(() => {
    if (!user) return

    const loadCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns")
        if (response.ok) {
          const data = await response.json()
          setCampaigns(data.campaigns || [])
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error)
        toast({
          title: "Error",
          description: "Failed to load campaigns",
          variant: "destructive",
        })
      }
    }

    loadCampaigns()
  }, [user, toast])

  // Load sessions when campaign changes
  useEffect(() => {
    if (!selectedCampaign) {
      setSessions([])
      setSelectedSession("")
      return
    }

    const loadSessions = async () => {
      try {
        const response = await fetch(`/api/sessions?campaignId=${selectedCampaign}`)
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        }
      } catch (error) {
        console.error("Failed to load sessions:", error)
        toast({
          title: "Error",
          description: "Failed to load sessions",
          variant: "destructive",
        })
      }
    }

    loadSessions()
  }, [selectedCampaign, toast])

  // Load battles when session changes
  useEffect(() => {
    if (!selectedSession) {
      setBattles([])
      setSelectedBattle("")
      return
    }

    const loadBattles = async () => {
      try {
        const response = await fetch(`/api/battles?sessionId=${selectedSession}`)
        if (response.ok) {
          const data = await response.json()
          setBattles(data.battles || [])
        }
      } catch (error) {
        console.error("Failed to load battles:", error)
      }
    }

    loadBattles()
  }, [selectedSession])

  // Create new campaign
  const createCampaign = async (name: string) => {
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        const data = await response.json()
        setCampaigns((prev) => [...prev, data.campaign])
        toast({
          title: "Success",
          description: "Campaign created successfully",
        })
      }
    } catch (error) {
      console.error("Failed to create campaign:", error)
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive",
      })
    }
  }

  // Create new session
  const createSession = async (name: string) => {
    if (!selectedCampaign) return

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, campaignId: selectedCampaign }),
      })

      if (response.ok) {
        const data = await response.json()
        setSessions((prev) => [...prev, data.session])
        toast({
          title: "Success",
          description: "Session created successfully",
        })
      }
    } catch (error) {
      console.error("Failed to create session:", error)
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      })
    }
  }

  // Handle battle generation
  const handleBattleGenerated = (battle: Battle) => {
    setBattles((prev) => [...prev, battle])
    setSelectedBattle(battle.id)

    // Add battle tokens to map if map exists
    if (memoMap) {
      const battleTokens = tokensFromBattle(battle)
      updateSessionState({
        ...sessionState,
        tokens: [...(sessionState?.tokens || []), ...battleTokens],
      })
    }
  }

  // Handle loot generation
  const handleLootGenerated = (result: LootResult) => {
    setLootResults((prev) => [...prev, result])
  }

  // Handle map regeneration
  const regenerateMap = async () => {
    if (!selectedBattle) return

    try {
      const response = await fetch(`/api/battles/${selectedBattle}/regenerate-map`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        updateSessionState({
          ...sessionState,
          map: data.mapUrl,
        })
        toast({
          title: "Success",
          description: "Map regenerated successfully",
        })
      }
    } catch (error) {
      console.error("Failed to regenerate map:", error)
      toast({
        title: "Error",
        description: "Failed to regenerate map",
        variant: "destructive",
      })
    }
  }

  // Handle token updates
  const handleTokenUpdate = (tokens: MapToken[]) => {
    updateSessionState({
      ...sessionState,
      tokens,
    })
  }

  // Handle creature click for stat block
  const handleCreatureClick = (creature: any) => {
    setSelectedCreature(creature)
    setShowStatBlock(true)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Welcome to RPG Campaign Manager</CardTitle>
            <CardDescription>Please sign in to continue</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">RPG Campaign Manager</h1>
          <p className="text-muted-foreground">Manage your campaigns, sessions, and adventures</p>
        </div>

        {/* Campaign Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Campaign Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="campaign-select">Select Campaign</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} {campaign.is_owner ? "(Owner)" : "(Member)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Campaign</DialogTitle>
                    <DialogDescription>Create a new campaign to organize your adventures</DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const formData = new FormData(e.currentTarget)
                      const name = formData.get("name") as string
                      if (name) createCampaign(name)
                    }}
                  >
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Campaign Name</Label>
                        <Input id="name" name="name" placeholder="Enter campaign name..." required />
                      </div>
                      <Button type="submit" className="w-full">
                        Create Campaign
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Session Selection */}
        {selectedCampaign && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Session Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="session-select">Select Session</Label>
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a session..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Session</DialogTitle>
                      <DialogDescription>Create a new session for this campaign</DialogDescription>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        const formData = new FormData(e.currentTarget)
                        const name = formData.get("name") as string
                        if (name) createSession(name)
                      }}
                    >
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="session-name">Session Name</Label>
                          <Input id="session-name" name="name" placeholder="Enter session name..." required />
                        </div>
                        <Button type="submit" className="w-full">
                          Create Session
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {selectedSession && (
          <Tabs defaultValue="battle" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="battle" className="flex items-center gap-2">
                <Sword className="h-4 w-4" />
                Battle
              </TabsTrigger>
              <TabsTrigger value="loot" className="flex items-center gap-2">
                <Dice6 className="h-4 w-4" />
                Loot
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="initiative" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Initiative
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="battle" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BattleForm
                  sessionId={selectedSession}
                  onBattleGenerated={handleBattleGenerated}
                  isGenerating={isGeneratingBattle}
                  setIsGenerating={setIsGeneratingBattle}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Battle History</CardTitle>
                    <CardDescription>Previous battles in this session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {battles.map((battle) => (
                          <div
                            key={battle.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedBattle === battle.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                            }`}
                            onClick={() => setSelectedBattle(battle.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{battle.name}</h4>
                                <p className="text-sm text-muted-foreground">{battle.entities?.length || 0} entities</p>
                              </div>
                              <Badge variant={selectedBattle === battle.id ? "default" : "secondary"}>
                                {selectedBattle === battle.id ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Battle Details */}
              {selectedBattle && (
                <Card>
                  <CardHeader>
                    <CardTitle>Battle Details</CardTitle>
                    <CardDescription>Entities and actions for the current battle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const battle = battles.find((b) => b.id === selectedBattle)
                      if (!battle) return <p>Battle not found</p>

                      return (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">{battle.name}</h3>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={regenerateMap}>
                                Regenerate Map
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TokenList
                              tokens={battle.entities || []}
                              onTokenClick={handleCreatureClick}
                              title="Monsters"
                              filter={(token) => token.type === "monster"}
                            />
                            <TokenList
                              tokens={battle.entities || []}
                              onTokenClick={handleCreatureClick}
                              title="Allies"
                              filter={(token) => token.type === "ally"}
                            />
                          </div>
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="loot" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LootForm
                  onLootGenerated={handleLootGenerated}
                  isGenerating={isGeneratingLoot}
                  setIsGenerating={setIsGeneratingLoot}
                />

                <LootResults results={lootResults} />
              </div>

              <LootHistory sessionId={selectedSession} />
            </TabsContent>

            <TabsContent value="map" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Battle Map</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={regenerateMap} disabled={!selectedBattle}>
                        Regenerate Map
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>Interactive battle map with tokens and positioning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <CanvasMap
                      mapUrl={memoMap}
                      tokens={sessionState?.tokens || []}
                      onTokensUpdate={handleTokenUpdate}
                      width={800}
                      height={600}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="initiative" className="space-y-6">
              <Initiative sessionId={selectedSession} battleId={selectedBattle} />
            </TabsContent>

            <TabsContent value="chat" className="space-y-6">
              <ChatMessages
                sessionId={selectedSession}
                messages={messages}
                onSendMessage={sendMessage}
                isLoading={isChatLoading}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Stat Block Dialog */}
        <Dialog open={showStatBlock} onOpenChange={setShowStatBlock}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCreature?.name || "Creature Stats"}</DialogTitle>
            </DialogHeader>
            {selectedCreature && <StatBlock creature={selectedCreature} />}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

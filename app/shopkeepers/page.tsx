"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Store, Users, ArrowLeft, Sparkles, Coins } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@clerk/nextjs"

interface Campaign {
  id: string
  name: string
  is_owner?: boolean
  is_member?: boolean
  member_role?: string
}

interface Shopkeeper {
  id: string
  name: string
  race: string
  age: number
  alignment: string
  quote: string
  description: string
  shop_type: string
  image_url: string | null
  created_at: string
  inventory: ShopItem[]
}

interface ShopItem {
  id: string
  item_name: string
  rarity: string
  base_price: number
  price_adjustment_percent: number
  final_price: number
  stock_quantity: number
}

interface PlayerGold {
  player_id: string
  gold_amount: number
}

export default function ShopkeepersPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [playersGold, setPlayersGold] = useState<PlayerGold[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Get campaignId from URL params
  const urlCampaignId = searchParams.get("campaignId")
  const autoGenerate = searchParams.get("autoGenerate") === "1"

  // Load campaigns on mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns")
        if (!response.ok) throw new Error("Failed to fetch campaigns")

        const data = await response.json()
        const campaignsList = data.campaigns || []
        setCampaigns(campaignsList)

        // Set selected campaign from URL or first available
        if (urlCampaignId && campaignsList.find((c: Campaign) => c.id === urlCampaignId)) {
          setSelectedCampaignId(urlCampaignId)
        } else if (campaignsList.length > 0) {
          setSelectedCampaignId(campaignsList[0].id)
        }
      } catch (error) {
        console.error("Error fetching campaigns:", error)
        toast({
          title: "Error",
          description: "Failed to load campaigns",
          variant: "destructive",
        })
      }
    }

    fetchCampaigns()
  }, [urlCampaignId, toast])

  // Load shopkeepers when campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      fetchShopkeepers()
      fetchPlayersGold()
    }
  }, [selectedCampaignId])

  // Auto-generate if requested
  useEffect(() => {
    if (autoGenerate && selectedCampaignId && shopkeepers.length === 0) {
      handleGenerateShopkeepers()
    }
  }, [autoGenerate, selectedCampaignId, shopkeepers.length])

  const fetchShopkeepers = async () => {
    if (!selectedCampaignId) return

    try {
      setLoading(true)
      console.log("[ShopkeepersPage] Fetching shopkeepers for campaign:", selectedCampaignId)

      const response = await fetch(`/api/shopkeepers?campaignId=${selectedCampaignId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log("[ShopkeepersPage] Shopkeepers response:", data)

      setShopkeepers(data.shopkeepers || [])
    } catch (error) {
      console.error("[ShopkeepersPage] Error fetching shopkeepers:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load shopkeepers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPlayersGold = async () => {
    if (!selectedCampaignId) return

    try {
      const response = await fetch(`/api/players/gold?campaignId=${selectedCampaignId}`)
      if (response.ok) {
        const data = await response.json()
        setPlayersGold(data.rows || [])
      }
    } catch (error) {
      console.error("Error fetching players gold:", error)
    }
  }

  const handleGenerateShopkeepers = async () => {
    if (!selectedCampaignId) return

    try {
      setGenerating(true)
      console.log("[ShopkeepersPage] Generating shopkeepers for campaign:", selectedCampaignId)

      const response = await fetch("/api/shopkeepers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaignId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate shopkeepers")
      }

      const data = await response.json()
      console.log("[ShopkeepersPage] Generated shopkeepers:", data)

      toast({
        title: "Success",
        description: `Generated ${data.shopkeepers?.length || 0} shopkeepers!`,
      })

      await fetchShopkeepers()
    } catch (error) {
      console.error("[ShopkeepersPage] Error generating shopkeepers:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate shopkeepers",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdatePlayerGold = async (playerId: string, newAmount: number) => {
    try {
      const response = await fetch("/api/players/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          campaignId: selectedCampaignId,
          goldAmount: newAmount,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update gold")
      }

      toast({
        title: "Success",
        description: "Player gold updated successfully",
      })

      await fetchPlayersGold()
    } catch (error) {
      console.error("Error updating player gold:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update gold",
        variant: "destructive",
      })
    }
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId)
  const isDM = selectedCampaign?.is_owner || selectedCampaign?.member_role === "DM"

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-8 w-8" />
              Shopkeepers
            </h1>
            <p className="text-gray-400">Manage NPCs and shops for your campaign</p>
          </div>
        </div>

        {/* Campaign Selection */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle>Select Campaign</CardTitle>
            <CardDescription>Choose which campaign's shopkeepers to manage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label htmlFor="campaign-select">Campaign</Label>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}{" "}
                        {campaign.is_owner ? "(Owner)" : campaign.is_member ? `(${campaign.member_role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isDM && (
                <Button
                  onClick={handleGenerateShopkeepers}
                  disabled={!selectedCampaignId || generating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Shopkeepers
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedCampaignId ? (
          <Tabs defaultValue="shopkeepers" className="space-y-6">
            <TabsList className="bg-gray-800">
              <TabsTrigger value="shopkeepers" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Shopkeepers ({shopkeepers.length})
              </TabsTrigger>
              {isDM && (
                <TabsTrigger value="players" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Player Gold
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="shopkeepers" className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    <span>Loading shopkeepers...</span>
                  </div>
                </div>
              ) : shopkeepers.length === 0 ? (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Store className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Shopkeepers Yet</h3>
                    <p className="text-gray-400 text-center mb-4">This campaign doesn't have any shopkeepers yet.</p>
                    {isDM && (
                      <Button
                        onClick={handleGenerateShopkeepers}
                        disabled={generating}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Shopkeepers
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {shopkeepers.map((shopkeeper) => (
                    <Card key={shopkeeper.id} className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{shopkeeper.name}</CardTitle>
                            <CardDescription>
                              {shopkeeper.race} • {shopkeeper.shop_type}
                            </CardDescription>
                          </div>
                          <Badge variant="outline">{shopkeeper.alignment}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-300 italic">"{shopkeeper.quote}"</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">{shopkeeper.description}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Inventory ({shopkeeper.inventory.length} items)</h4>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {shopkeeper.inventory.slice(0, 5).map((item) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span className="truncate">{item.item_name}</span>
                                <span className="text-yellow-400">{item.final_price}gp</span>
                              </div>
                            ))}
                            {shopkeeper.inventory.length > 5 && (
                              <p className="text-xs text-gray-500">+{shopkeeper.inventory.length - 5} more items...</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {isDM && (
              <TabsContent value="players" className="space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-5 w-5" />
                      Player Gold Management
                    </CardTitle>
                    <CardDescription>Manage gold amounts for players in this campaign</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {playersGold.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No player gold records found</p>
                        <p className="text-sm">Gold records are created when players make purchases</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {playersGold.map((playerGold) => (
                          <div
                            key={playerGold.player_id}
                            className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{playerGold.player_id.substring(0, 12)}...</p>
                              <p className="text-sm text-gray-400">Player ID</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={playerGold.gold_amount}
                                onChange={(e) => {
                                  const newAmount = Number.parseFloat(e.target.value) || 0
                                  setPlayersGold((prev) =>
                                    prev.map((p) =>
                                      p.player_id === playerGold.player_id ? { ...p, gold_amount: newAmount } : p,
                                    ),
                                  )
                                }}
                                className="w-24 bg-gray-600 border-gray-500"
                                min="0"
                                step="0.01"
                              />
                              <span className="text-yellow-400 font-medium">gp</span>
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePlayerGold(playerGold.player_id, playerGold.gold_amount)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Update
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center text-gray-400">
                <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a campaign to view its shopkeepers</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

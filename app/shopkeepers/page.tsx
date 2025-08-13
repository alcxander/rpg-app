"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, Plus, Minus, ShoppingCart, Users, Settings } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  quantity: number
  rarity: string
  category: string
}

interface Shopkeeper {
  id: string
  name: string
  description: string
  location: string
  personality: string
  inventory: ShopItem[]
}

interface PlayerGold {
  player_id: string
  gold_amount: number
  player_name: string
  player_clerk_id: string
  role?: string
  joined_at?: string
}

export default function ShopkeepersPage() {
  const { user } = useUser()
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [playerGold, setPlayerGold] = useState<number>(0)
  const [allPlayersGold, setAllPlayersGold] = useState<PlayerGold[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [generatingShopkeepers, setGeneratingShopkeepers] = useState(false)
  const [generatingItems, setGeneratingItems] = useState<string | null>(null)

  // Load campaigns on mount
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns")
        if (response.ok) {
          const data = await response.json()
          setCampaigns(data.campaigns || [])
          // Auto-select first campaign if available
          if (data.campaigns?.length > 0) {
            setSelectedCampaign(data.campaigns[0].id)
          }
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error)
      }
    }
    loadCampaigns()
  }, [])

  // Load data when campaign changes
  useEffect(() => {
    if (selectedCampaign && user) {
      loadShopkeepers()
      loadPlayerGold()
      if (isOwner) {
        loadAllPlayersGold()
      }
    }
  }, [selectedCampaign, user, isOwner])

  const loadShopkeepers = async () => {
    if (!selectedCampaign) return

    setLoading(true)
    try {
      const response = await fetch(`/api/shopkeepers?campaignId=${selectedCampaign}`)
      if (response.ok) {
        const data = await response.json()
        setShopkeepers(data.shopkeepers || [])
        setIsOwner(data.isOwner || false)
        console.log("Shopkeepers loaded:", {
          count: data.shopkeepers?.length || 0,
          isOwner: data.isOwner,
          userId: user?.id?.substring(0, 12) + "...",
        })
      } else {
        console.error("Failed to load shopkeepers:", response.status)
        toast({
          title: "Error",
          description: "Failed to load shopkeepers",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading shopkeepers:", error)
      toast({
        title: "Error",
        description: "Failed to load shopkeepers",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPlayerGold = async () => {
    if (!selectedCampaign || !user) return

    try {
      const response = await fetch(`/api/players/gold?campaignId=${selectedCampaign}&playerId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const goldRecord = data.rows?.[0]
        setPlayerGold(goldRecord?.gold_amount || 0)
      }
    } catch (error) {
      console.error("Failed to load player gold:", error)
    }
  }

  const loadAllPlayersGold = async () => {
    if (!selectedCampaign || !isOwner) return

    try {
      console.log("Loading all players gold for campaign:", selectedCampaign)
      const response = await fetch(`/api/players/gold?campaignId=${selectedCampaign}`)
      if (response.ok) {
        const data = await response.json()
        console.log("All players gold loaded:", data.rows?.length || 0)
        setAllPlayersGold(data.rows || [])
      } else {
        console.error("Failed to load all players gold:", response.status)
        const errorText = await response.text()
        console.error("Error response:", errorText)
        toast({
          title: "Error",
          description: "Failed to load player gold data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading all players gold:", error)
      toast({
        title: "Error",
        description: "Failed to load player gold data",
        variant: "destructive",
      })
    }
  }

  const updatePlayerGold = async (playerId: string, newAmount: number) => {
    if (!selectedCampaign) return

    try {
      const response = await fetch("/api/players/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          campaignId: selectedCampaign,
          goldAmount: newAmount,
        }),
      })

      if (response.ok) {
        // Update local state
        setAllPlayersGold((prev) => prev.map((p) => (p.player_id === playerId ? { ...p, gold_amount: newAmount } : p)))
        toast({
          title: "Success",
          description: "Player gold updated successfully",
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to update player gold",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating player gold:", error)
      toast({
        title: "Error",
        description: "Failed to update player gold",
        variant: "destructive",
      })
    }
  }

  const adjustStock = async (shopkeeperId: string, itemId: string, change: number) => {
    try {
      const response = await fetch(`/api/shopkeepers/inventory/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change }),
      })

      if (response.ok) {
        // Update local state without full reload
        setShopkeepers((prev) =>
          prev.map((shopkeeper) =>
            shopkeeper.id === shopkeeperId
              ? {
                  ...shopkeeper,
                  inventory: shopkeeper.inventory.map((item) =>
                    item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + change) } : item,
                  ),
                }
              : shopkeeper,
          ),
        )
        toast({
          title: "Success",
          description: `Stock ${change > 0 ? "increased" : "decreased"} successfully`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update stock",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adjusting stock:", error)
      toast({
        title: "Error",
        description: "Failed to update stock",
        variant: "destructive",
      })
    }
  }

  const buyItem = async (item: ShopItem) => {
    if (!user || !selectedCampaign) return

    if (playerGold < item.price) {
      toast({
        title: "Insufficient Gold",
        description: `You need ${item.price} gold but only have ${playerGold}`,
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/shopkeepers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          campaignId: selectedCampaign,
          playerId: user.id,
        }),
      })

      if (response.ok) {
        // Update local state
        setPlayerGold((prev) => prev - item.price)
        setShopkeepers((prev) =>
          prev.map((shopkeeper) => ({
            ...shopkeeper,
            inventory: shopkeeper.inventory.map((invItem) =>
              invItem.id === item.id ? { ...invItem, quantity: Math.max(0, invItem.quantity - 1) } : invItem,
            ),
          })),
        )
        toast({
          title: "Purchase Successful",
          description: `You bought ${item.name} for ${item.price} gold`,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Purchase Failed",
          description: errorData.error || "Failed to complete purchase",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error buying item:", error)
      toast({
        title: "Error",
        description: "Failed to complete purchase",
        variant: "destructive",
      })
    }
  }

  const generateShopkeepers = async () => {
    if (!selectedCampaign) return

    setGeneratingShopkeepers(true)
    try {
      const response = await fetch("/api/shopkeepers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign }),
      })

      if (response.ok) {
        await loadShopkeepers()
        toast({
          title: "Success",
          description: "New shopkeepers generated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to generate shopkeepers",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error generating shopkeepers:", error)
      toast({
        title: "Error",
        description: "Failed to generate shopkeepers",
        variant: "destructive",
      })
    } finally {
      setGeneratingShopkeepers(false)
    }
  }

  const generateItems = async (shopkeeperId: string) => {
    setGeneratingItems(shopkeeperId)
    try {
      const response = await fetch(`/api/shopkeepers/${shopkeeperId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign }),
      })

      if (response.ok) {
        await loadShopkeepers()
        toast({
          title: "Success",
          description: "New items generated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to generate items",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error generating items:", error)
      toast({
        title: "Error",
        description: "Failed to generate items",
        variant: "destructive",
      })
    } finally {
      setGeneratingItems(null)
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case "common":
        return "bg-gray-100 text-gray-800"
      case "uncommon":
        return "bg-green-100 text-green-800"
      case "rare":
        return "bg-blue-100 text-blue-800"
      case "epic":
        return "bg-purple-100 text-purple-800"
      case "legendary":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading shopkeepers...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Shopkeepers</h1>
          <p className="text-muted-foreground">Browse and manage shops in your campaign</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Campaign Selector */}
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Select Campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          {/* Player Gold Display (for non-DMs) */}
          {!isOwner && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-md">
              <Coins className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">{playerGold} gold</span>
            </div>
          )}

          {/* Debug Info */}
          <div className="text-xs text-muted-foreground">
            DM: {isOwner ? "Yes" : "No"} | User: {user?.id?.substring(0, 8)}...
          </div>
        </div>
      </div>

      <Tabs defaultValue="market" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="market">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Market
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="players">
              <Users className="h-4 w-4 mr-2" />
              Players
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="management">
              <Settings className="h-4 w-4 mr-2" />
              Management
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="market" className="space-y-6">
          {shopkeepers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Shopkeepers Available</h3>
                <p className="text-muted-foreground text-center">
                  {isOwner
                    ? "Generate some shopkeepers to get started with your campaign's economy."
                    : "Ask your DM to set up some shopkeepers for this campaign."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {shopkeepers.map((shopkeeper) => (
                <Card key={shopkeeper.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">{shopkeeper.name}</CardTitle>
                    <CardDescription>{shopkeeper.description}</CardDescription>
                    <div className="text-sm text-muted-foreground">
                      <div>
                        <strong>Location:</strong> {shopkeeper.location}
                      </div>
                      <div>
                        <strong>Personality:</strong> {shopkeeper.personality}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Inventory</h4>
                      {shopkeeper.inventory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items in stock</p>
                      ) : (
                        <div className="space-y-2">
                          {shopkeeper.inventory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{item.name}</span>
                                  <Badge className={getRarityColor(item.rarity)}>{item.rarity}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="font-medium">{item.price} gold</span>
                                  <span>Stock: {item.quantity}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isOwner ? (
                                  // DM sees +/- buttons
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => adjustStock(shopkeeper.id, item.id, -1)}
                                      disabled={item.quantity <= 0}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => adjustStock(shopkeeper.id, item.id, 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  // Players see Buy button
                                  <Button
                                    size="sm"
                                    onClick={() => buyItem(item)}
                                    disabled={item.quantity <= 0 || playerGold < item.price}
                                  >
                                    Buy
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="players" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Player Gold Management</CardTitle>
                <CardDescription>Manage gold amounts for all players in your campaign</CardDescription>
              </CardHeader>
              <CardContent>
                {allPlayersGold.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Players Found</h3>
                    <p className="text-muted-foreground">Invite players to your campaign to manage their gold.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allPlayersGold.map((player) => (
                      <div key={player.player_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">{player.player_name}</div>
                          <div className="text-sm text-muted-foreground">Role: {player.role || "Player"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Coins className="h-4 w-4 text-yellow-600" />
                            <Input
                              type="number"
                              value={player.gold_amount}
                              onChange={(e) => {
                                const newAmount = Math.max(0, Number.parseInt(e.target.value) || 0)
                                setAllPlayersGold((prev) =>
                                  prev.map((p) =>
                                    p.player_id === player.player_id ? { ...p, gold_amount: newAmount } : p,
                                  ),
                                )
                              }}
                              className="w-24"
                              min="0"
                            />
                          </div>
                          <Button size="sm" onClick={() => updatePlayerGold(player.player_id, player.gold_amount)}>
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

        {isOwner && (
          <TabsContent value="management" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Shopkeeper Management</CardTitle>
                <CardDescription>Generate and manage shopkeepers for your campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={generateShopkeepers} disabled={generatingShopkeepers} className="w-full">
                  {generatingShopkeepers ? "Generating..." : "Generate New Shopkeepers"}
                </Button>

                {shopkeepers.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Generate Items for Existing Shopkeepers</h4>
                    <div className="grid gap-2">
                      {shopkeepers.map((shopkeeper) => (
                        <div key={shopkeeper.id} className="flex items-center justify-between p-3 border rounded">
                          <span className="font-medium">{shopkeeper.name}</span>
                          <Button
                            size="sm"
                            onClick={() => generateItems(shopkeeper.id)}
                            disabled={generatingItems === shopkeeper.id}
                          >
                            {generatingItems === shopkeeper.id ? "Generating..." : "Generate Items"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

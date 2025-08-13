"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Minus, Trash2, ShoppingCart, Coins } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Shop } from "@/lib/types"

export default function ShopkeepersPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { toast } = useToast()
  const [shops, setShops] = useState<Shop[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [userRole, setUserRole] = useState<"DM" | "Player" | null>(null)
  const [playerGold, setPlayerGold] = useState<number>(0)

  // Load campaigns on mount
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadCampaigns()
    }
  }, [isLoaded, isSignedIn])

  // Load shops when campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      loadShops()
      loadPlayerGold()
    }
  }, [selectedCampaignId])

  const loadCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns")
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.campaigns || [])
        if (data.campaigns?.length > 0) {
          setSelectedCampaignId(data.campaigns[0].id)
        }
      }
    } catch (error) {
      console.error("Failed to load campaigns:", error)
    }
  }

  const loadShops = async () => {
    if (!selectedCampaignId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/shopkeepers?campaignId=${selectedCampaignId}`)
      if (response.ok) {
        const data = await response.json()
        setShops(data.shops || [])

        // Determine user role based on campaign
        const campaign = campaigns.find((c) => c.id === selectedCampaignId)
        if (campaign) {
          if (campaign.is_owner) {
            setUserRole("DM")
          } else if (campaign.is_member) {
            setUserRole("Player")
          }
        }
      } else {
        console.error("Failed to load shops")
        setShops([])
      }
    } catch (error) {
      console.error("Error loading shops:", error)
      setShops([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadPlayerGold = async () => {
    if (!selectedCampaignId) return

    try {
      const response = await fetch(`/api/players/gold?campaignId=${selectedCampaignId}`)
      if (response.ok) {
        const data = await response.json()
        setPlayerGold(data.gold || 0)
      }
    } catch (error) {
      console.error("Failed to load player gold:", error)
    }
  }

  const generateShopkeeper = async () => {
    if (!selectedCampaignId) return

    setIsGenerating(true)
    try {
      const response = await fetch("/api/shopkeepers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaignId }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "New shopkeeper generated!" })
        loadShops()
      } else {
        const error = await response.json()
        toast({ title: "Error", description: error.error || "Failed to generate shopkeeper", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate shopkeeper", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const quickSeed = async () => {
    if (!selectedCampaignId) return

    setIsGenerating(true)
    try {
      const response = await fetch("/api/shopkeepers/quick-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaignId }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Campaign seeded with shopkeepers!" })
        loadShops()
      } else {
        const error = await response.json()
        toast({ title: "Error", description: error.error || "Failed to seed campaign", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to seed campaign", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const updateQuantity = async (shopId: string, itemIndex: number, change: number) => {
    try {
      const response = await fetch(`/api/shopkeepers/inventory/${shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIndex, quantityChange: change }),
      })

      if (response.ok) {
        loadShops()
      } else {
        const error = await response.json()
        toast({ title: "Error", description: error.error || "Failed to update quantity", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" })
    }
  }

  const removeShopkeeper = async (shopId: string) => {
    try {
      const response = await fetch(`/api/shopkeepers/${shopId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({ title: "Success", description: "Shopkeeper removed" })
        loadShops()
      } else {
        const error = await response.json()
        toast({ title: "Error", description: error.error || "Failed to remove shopkeeper", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove shopkeeper", variant: "destructive" })
    }
  }

  const purchaseItem = async (shopId: string, itemIndex: number, item: any) => {
    if (playerGold < item.value) {
      toast({
        title: "Insufficient Gold",
        description: `You need ${item.value} gold but only have ${playerGold}`,
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/shopkeepers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          itemIndex,
          campaignId: selectedCampaignId,
        }),
      })

      if (response.ok) {
        toast({ title: "Purchase Successful", description: `Bought ${item.name} for ${item.value} gold` })
        loadShops()
        loadPlayerGold()
      } else {
        const error = await response.json()
        toast({
          title: "Purchase Failed",
          description: error.error || "Failed to purchase item",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to purchase item", variant: "destructive" })
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case "common":
        return "bg-gray-500"
      case "uncommon":
        return "bg-green-500"
      case "rare":
        return "bg-blue-500"
      case "very rare":
        return "bg-purple-500"
      case "legendary":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shopkeepers</h1>
          <p className="text-muted-foreground">Manage shops and inventory for your campaigns</p>
        </div>
        {userRole === "Player" && (
          <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-lg">
            <Coins className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold text-yellow-800">{playerGold} Gold</span>
          </div>
        )}
      </div>

      {/* Campaign Selection */}
      <div className="flex items-center gap-4">
        <label htmlFor="campaign-select" className="font-medium">
          Campaign:
        </label>
        <select
          id="campaign-select"
          value={selectedCampaignId}
          onChange={(e) => setSelectedCampaignId(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="">Select a campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} {campaign.is_owner ? "(Owner)" : campaign.is_member ? `(${campaign.member_role})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* DM Controls */}
      {userRole === "DM" && (
        <div className="flex gap-4">
          <Button onClick={generateShopkeeper} disabled={isGenerating || !selectedCampaignId}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate Shopkeeper
          </Button>
          <Button onClick={quickSeed} disabled={isGenerating || !selectedCampaignId} variant="outline">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Quick Seed (3 Shops)
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Shops Grid */}
      {!isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <Card key={shop.id} className="relative overflow-hidden">
              {/* Color diffusion blob */}
              <div
                className="absolute inset-0 opacity-10 blur-3xl"
                style={{
                  background: `radial-gradient(circle at 30% 20%, hsl(${Math.abs(shop.keeper.name.charCodeAt(0) * 137) % 360}, 70%, 60%), transparent 50%)`,
                }}
              />

              <CardHeader className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Profile picture */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{
                        background: `linear-gradient(135deg, hsl(${Math.abs(shop.keeper.name.charCodeAt(0) * 137) % 360}, 70%, 50%), hsl(${Math.abs(shop.keeper.name.charCodeAt(0) * 137 + 60) % 360}, 70%, 60%))`,
                      }}
                    >
                      {shop.keeper.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{shop.name}</CardTitle>
                      <CardDescription>
                        {shop.keeper.name} • {shop.keeper.race} • Age {shop.keeper.age}
                      </CardDescription>
                    </div>
                  </div>
                  {userRole === "DM" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShopkeeper(shop.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm italic text-muted-foreground mt-2">"{shop.keeper.quote}"</p>
                <Badge variant="secondary" className="w-fit">
                  {shop.keeper.temperament}
                </Badge>
              </CardHeader>

              <CardContent className="relative space-y-4">
                <h4 className="font-semibold">Inventory ({shop.inventory.length} items)</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {shop.inventory.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name}</span>
                          <Badge className={`${getRarityColor(item.rarity)} text-white text-xs`}>{item.rarity}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-medium">{item.value}g</span>
                          <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        {userRole === "DM" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(shop.id, index, -1)}
                              disabled={item.quantity <= 0}
                              className="h-6 w-6 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(shop.id, index, 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {userRole === "Player" && item.quantity > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => purchaseItem(shop.id, index, item)}
                            disabled={playerGold < item.value}
                            className="h-6 px-2"
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Buy
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && shops.length === 0 && selectedCampaignId && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No shopkeepers found for this campaign.</p>
          {userRole === "DM" && (
            <Button onClick={generateShopkeeper} disabled={isGenerating}>
              Generate Your First Shopkeeper
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

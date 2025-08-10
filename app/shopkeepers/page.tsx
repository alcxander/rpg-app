"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useUser, RedirectToSignIn } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import {
  Plus,
  RefreshCw,
  ToggleRight,
  Coins,
  ShoppingCart,
  Shield,
  Loader2,
  Home,
  AlertTriangle,
  Wrench,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type CampaignOption = { id: string; name: string; access_enabled?: boolean; dm_id?: string }

type InventoryItem = {
  id: string
  item_name: string
  rarity: string
  base_price: number
  price_adjustment_percent: number
  final_price: number
  stock_quantity: number
}

type Shopkeeper = {
  id: string
  name: string
  race: string
  age: number
  alignment: string
  quote: string
  description: string
  shop_type: string
  image_url: string | null
  inventory: InventoryItem[]
  created_at: string
}

export default function ShopkeepersPage() {
  const router = useRouter()
  const search = useSearchParams()
  const { isLoaded, isSignedIn } = useUser()
  const { toast } = useToast()

  // Campaign selection
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  // Data
  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [campaignAccessEnabled, setCampaignAccessEnabled] = useState<boolean>(true)
  const [isOwner, setIsOwner] = useState<boolean>(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState(5)
  const [sessionId, setSessionId] = useState<string>("")

  // Utility: safe JSON parsing using Response.clone() to avoid "body stream already read"
  const parseJsonSafe = async (res: Response) => {
    const clone = res.clone()
    try {
      const data = await clone.json()
      return { data, raw: JSON.stringify(data) }
    } catch {
      const text = await res.text().catch(() => "")
      return { data: null as any, raw: text }
    }
  }

  const showError = (title: string, errorRaw: string) => {
    const raw = String(errorRaw || "").slice(0, 2000) // clamp size for toast
    toast({
      title,
      description: raw,
      variant: "destructive",
      className: "bg-red-600 text-white",
      action: (
        <ToastAction
          altText="Copy error"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(errorRaw)
            } catch {
              // ignore
            }
          }}
        >
          Copy
        </ToastAction>
      ),
    })
  }

  // Load campaigns
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    ;(async () => {
      try {
        const res = await fetch("/api/campaigns")
        const { data, raw } = await parseJsonSafe(res)
        if (!res.ok) throw new Error(raw || "Failed to load campaigns")
        setCampaigns(data.campaigns || [])
        if (!selectedCampaignId && data.campaigns?.[0]?.id) setSelectedCampaignId(data.campaigns[0].id)
      } catch (e: any) {
        showError("Failed to load campaigns", String(e?.message || e))
      }
    })()
  }, [isLoaded, isSignedIn]) // eslint-disable-line

  // Load shopkeepers for a campaign
  const loadShopkeepers = async (cid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shopkeepers?campaignId=${encodeURIComponent(cid)}`)
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Failed to load shopkeepers")
      setShopkeepers(data.shopkeepers || [])
      setCampaignAccessEnabled(Boolean(data.campaign?.access_enabled))
      setIsOwner(Boolean(data.campaign?.isOwner))
    } catch (e: any) {
      showError("Error loading shopkeepers", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedCampaignId) loadShopkeepers(selectedCampaignId)
  }, [selectedCampaignId]) // eslint-disable-line

  // Generation action
  const onGenerate = async () => {
    if (!selectedCampaignId) return
    setGenerating(true)
    try {
      const res = await fetch("/api/shopkeepers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaignId, count }),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Generation failed")
      toast({ title: "Shopkeepers created", className: "bg-green-600 text-white" })
      await loadShopkeepers(selectedCampaignId)
    } catch (e: any) {
      showError("Generation error", String(e?.message || e))
    } finally {
      setGenerating(false)
    }
  }

  // DM toggle
  const toggleAccess = async () => {
    if (!selectedCampaignId) return
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/shop-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_enabled: !campaignAccessEnabled }),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Failed to update")
      setCampaignAccessEnabled(Boolean(data.campaign?.access_enabled))
      toast({
        title: `Shop access ${data.campaign?.access_enabled ? "enabled" : "disabled"}`,
        className: "bg-green-600 text-white",
      })
    } catch (e: any) {
      showError("Error", String(e?.message || e))
    }
  }

  const onBuy = async (inventoryId: string, quantity: number) => {
    try {
      const res = await fetch("/api/shopkeepers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId, quantity, sessionId: sessionId || null }),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Purchase failed")
      toast({ title: "Purchased", className: "bg-green-600 text-white" })
      if (selectedCampaignId) await loadShopkeepers(selectedCampaignId)
    } catch (e: any) {
      showError("Purchase error", String(e?.message || e))
    }
  }

  const onUpdateStock = async (shopkeeperId: string, id: string, stock: number, price?: number) => {
    try {
      const res = await fetch(`/api/shopkeepers/${shopkeeperId}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          stock_quantity: stock,
          ...(typeof price === "number" ? { final_price: price } : {}),
        }),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Update failed")
      toast({ title: "Updated", className: "bg-green-600 text-white" })
      if (selectedCampaignId) await loadShopkeepers(selectedCampaignId)
    } catch (e: any) {
      showError("Error", String(e?.message || e))
    }
  }

  const onAddItem = async (
    shopkeeperId: string,
    payload: Partial<InventoryItem> & { rarity?: string; base_price?: number; final_price?: number },
  ) => {
    try {
      const res = await fetch(`/api/shopkeepers/${shopkeeperId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Add failed")
      toast({ title: "Item added", className: "bg-green-600 text-white" })
      if (selectedCampaignId) await loadShopkeepers(selectedCampaignId)
    } catch (e: any) {
      showError("Error", String(e?.message || e))
    }
  }

  const [goldEdits, setGoldEdits] = useState<Record<string, string>>({})
  const onSetGold = async (playerId: string, amount: number) => {
    if (!selectedCampaignId) return
    try {
      const res = await fetch("/api/players/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, campaignId: selectedCampaignId, goldAmount: amount }),
      })
      const { data, raw } = await parseJsonSafe(res)
      if (!res.ok) throw new Error(raw || "Update failed")
      toast({ title: "Gold updated", className: "bg-green-600 text-white" })
    } catch (e: any) {
      showError("Error", String(e?.message || e))
    }
  }

  // Auto-generate when coming from DM Tools
  const autoGenTriggered = useRef(false)
  const shouldAutoGenerate = useMemo(() => {
    const ag = search.get("autoGenerate")
    return ag === "1" || ag === "true"
  }, [search])

  useEffect(() => {
    if (!isOwner) return
    if (!selectedCampaignId) return
    if (!shouldAutoGenerate) return
    if (autoGenTriggered.current) return
    const c = Number(search.get("count") || "")
    if (Number.isFinite(c) && c >= 5 && c <= 20) setCount(c)
    autoGenTriggered.current = true
    onGenerate()
  }, [isOwner, selectedCampaignId, shouldAutoGenerate, search]) // eslint-disable-line

  if (!isLoaded) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="ml-3 text-gray-400">Loading...</p>
      </div>
    )
  }
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-purple-400">Shopkeepers</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              className="bg-gray-800 border border-gray-700 text-white"
              title="Go Home"
            >
              <Home className="w-4 h-4 mr-2" /> Home
            </Button>

            <Select value={selectedCampaignId || ""} onValueChange={(v) => setSelectedCampaignId(v)}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-64">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Session id (optional for activity log)"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white w-64"
            />

            <Button
              onClick={() => selectedCampaignId && loadShopkeepers(selectedCampaignId)}
              variant="secondary"
              className="bg-gray-800 border border-gray-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Generation status */}
        {generating && (
          <div className="mb-4 p-3 rounded border border-yellow-600/40 bg-yellow-500/10 text-yellow-200 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <div>
              <div className="font-medium">Generating shopkeepers...</div>
              <div className="text-xs opacity-80">Creating {count} shopkeepers. This may take a few seconds.</div>
            </div>
          </div>
        )}

        <Tabs defaultValue="market">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="management">Management</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>

          {/* Market Tab */}
          <TabsContent value="market" className="mt-4">
            {/* Always show DM Generate controls at the top of Market */}
            {isOwner && (
              <Card className="bg-gray-800 border-gray-700 mb-4">
                <CardContent className="py-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-300">Generate count</Label>
                    <Input
                      type="number"
                      min={5}
                      max={20}
                      value={count}
                      onChange={(e) => setCount(Number.parseInt(e.target.value || "5", 10))}
                      className="w-24 bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <Button
                    onClick={onGenerate}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={generating || !selectedCampaignId}
                    title="Generate new shopkeepers"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Generate Shopkeepers
                  </Button>
                  <Button
                    onClick={toggleAccess}
                    variant="secondary"
                    className="bg-gray-900 border border-gray-700 text-white"
                  >
                    <ToggleRight className="w-4 h-4 mr-2" />
                    {campaignAccessEnabled ? "Disable player access" : "Enable player access"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex items-center text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading shopkeepers...
              </div>
            ) : shopkeepers.length === 0 ? (
              <div className="flex flex-col items-start gap-3 text-gray-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-300" />
                  <p>No shopkeepers yet.</p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2">
                    <Label className="text-gray-300">Generate count</Label>
                    <Input
                      type="number"
                      min={5}
                      max={20}
                      value={count}
                      onChange={(e) => setCount(Number.parseInt(e.target.value || "5", 10))}
                      className="w-24 bg-gray-900 border-gray-700 text-white"
                    />
                    <Button
                      onClick={onGenerate}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={generating || !selectedCampaignId}
                    >
                      {generating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}{" "}
                      Generate Shopkeepers
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shopkeepers.map((sk) => (
                  <Card key={sk.id} className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>
                          {sk.name} <span className="text-xs text-gray-400">({sk.shop_type})</span>
                        </span>
                        {sk.image_url ? (
                          <img
                            src={sk.image_url || "/placeholder.svg?height=48&width=48&query=shopkeeper%20token"}
                            alt={`${sk.name} token`}
                            className="w-12 h-12 rounded-full object-cover border border-gray-600"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-700 border border-gray-600" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-300">
                        {sk.race}, {sk.alignment}, {sk.age} yrs
                      </p>
                      <p className="text-sm italic text-gray-400">"{sk.quote}"</p>
                      <p className="text-xs text-gray-400">{sk.description}</p>

                      <div className="border-t border-gray-700 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-200">Inventory</span>
                          <span className="text-xs text-gray-400">{sk.inventory.length} items</span>
                        </div>
                        <div className="space-y-2">
                          {sk.inventory.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-sm">
                              <div className="min-w-0">
                                <div className="font-medium text-gray-200 truncate">{it.item_name}</div>
                                <div className="text-xs text-gray-400">
                                  {it.rarity} • {it.final_price} gp • stock {it.stock_quantity}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isOwner ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-gray-700 text-white"
                                      onClick={() => onUpdateStock(sk.id, it.id, Math.max(0, it.stock_quantity - 1))}
                                      disabled={it.stock_quantity <= 0}
                                      title="Remove one (DM)"
                                    >
                                      -1
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-gray-700 text-white"
                                      onClick={() => onUpdateStock(sk.id, it.id, it.stock_quantity + 1)}
                                      title="Add one (DM)"
                                    >
                                      +1
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => onBuy(it.id, 1)}
                                    disabled={it.stock_quantity <= 0 || !campaignAccessEnabled}
                                    title="Buy 1"
                                  >
                                    <ShoppingCart className="w-4 h-4 mr-1" /> Buy
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management" className="mt-4">
            {isOwner ? (
              <>
                <Card className="bg-gray-800 border-gray-700 mb-4">
                  <CardContent className="py-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-300">Generate count</Label>
                      <Input
                        type="number"
                        min={5}
                        max={20}
                        value={count}
                        onChange={(e) => setCount(Number.parseInt(e.target.value || "5", 10))}
                        className="w-24 bg-gray-900 border-gray-700 text-white"
                      />
                    </div>
                    <Button
                      onClick={onGenerate}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={generating || !selectedCampaignId}
                    >
                      {generating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}{" "}
                      Generate Shopkeepers
                    </Button>
                    <Button
                      onClick={toggleAccess}
                      variant="secondary"
                      className="bg-gray-900 border border-gray-700 text-white"
                    >
                      <ToggleRight className="w-4 h-4 mr-2" />
                      {campaignAccessEnabled ? "Disable player access" : "Enable player access"}
                    </Button>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  {shopkeepers.map((sk) => (
                    <Card key={sk.id} className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-gray-400" />
                            {sk.name} <span className="text-xs text-gray-400">({sk.shop_type})</span>
                          </span>
                          <div className="flex items-center gap-2">
                            {sk.image_url ? (
                              <img
                                src={sk.image_url || "/placeholder.svg?height=40&width=40&query=shopkeeper%20token"}
                                alt={`${sk.name} token`}
                                className="w-10 h-10 rounded-full object-cover border border-gray-600"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600" />
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-300 mb-2">
                          {sk.race}, {sk.alignment}, {sk.age} yrs
                        </div>
                        <div className="text-xs text-gray-400 mb-3">{sk.description}</div>

                        <div className="text-sm font-semibold text-gray-200 mb-2">Inventory</div>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700">
                              <TableHead className="text-gray-400">Item</TableHead>
                              <TableHead className="text-gray-400">Rarity</TableHead>
                              <TableHead className="text-gray-400">Price</TableHead>
                              <TableHead className="text-gray-400">Stock</TableHead>
                              <TableHead />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sk.inventory.map((it) => (
                              <TableRow key={it.id} className="border-gray-800">
                                <TableCell className="text-gray-200">{it.item_name}</TableCell>
                                <TableCell className="text-gray-300">{it.rarity}</TableCell>
                                <TableCell className="text-gray-300">{it.final_price} gp</TableCell>
                                <TableCell className="text-gray-300">{it.stock_quantity}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-gray-700 text-white"
                                      onClick={() => onUpdateStock(sk.id, it.id, Math.max(0, it.stock_quantity - 1))}
                                    >
                                      -1
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-gray-700 text-white"
                                      onClick={() => onUpdateStock(sk.id, it.id, it.stock_quantity + 1)}
                                    >
                                      +1
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <AddItemForm onAdd={(payload) => onAddItem(sk.id, payload)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400">Only the DM can access management.</p>
            )}
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="mt-4">
            {isOwner ? (
              <PlayersGoldEditor
                campaignId={selectedCampaignId!}
                onSetGold={onSetGold}
                goldEdits={goldEdits}
                setGoldEdits={setGoldEdits}
              />
            ) : (
              <p className="text-gray-400">Only the DM can edit player gold.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function AddItemForm({ onAdd }: { onAdd: (payload: any) => void }) {
  const [item_name, setName] = useState("")
  const [rarity, setRarity] = useState("common")
  const [base_price, setBase] = useState("10")
  const [final_price, setFinal] = useState("10")
  const [stock_quantity, setStock] = useState("1")
  return (
    <div className="mt-4 border-t border-gray-700 pt-3">
      <div className="text-sm font-semibold text-gray-200 mb-2">Add Item</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <Input
          className="bg-gray-900 border-gray-700 text-white"
          placeholder="Item name"
          value={item_name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select value={rarity} onValueChange={setRarity}>
          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
            <SelectValue placeholder="Rarity" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-white">
            {["common", "uncommon", "rare", "wondrous", "legendary"].map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.01"
          className="bg-gray-900 border-gray-700 text-white"
          placeholder="Base gp"
          value={base_price}
          onChange={(e) => setBase(e.target.value)}
        />
        <Input
          type="number"
          step="0.01"
          className="bg-gray-900 border-gray-700 text-white"
          placeholder="Final gp"
          value={final_price}
          onChange={(e) => setFinal(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            type="number"
            className="bg-gray-900 border-gray-700 text-white"
            placeholder="Qty"
            value={stock_quantity}
            onChange={(e) => setStock(e.target.value)}
          />
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => {
              const payload = {
                item_name,
                rarity,
                base_price: Number(base_price || 0),
                final_price: Number(final_price || 0),
                stock_quantity: Number(stock_quantity || 0),
                price_adjustment_percent: 0,
              }
              onAdd(payload)
              setName("")
              setStock("1")
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>
    </div>
  )
}

function PlayersGoldEditor({
  campaignId,
  onSetGold,
  goldEdits,
  setGoldEdits,
}: {
  campaignId: string
  onSetGold: (playerId: string, amount: number) => void
  goldEdits: Record<string, string>
  setGoldEdits: (s: Record<string, string>) => void
}) {
  const [rows, setRows] = useState<{ player_id: string; name?: string; gold_amount: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    ;(async () => {
      try {
        const resSessions = await fetch(`/api/sessions?campaignId=${encodeURIComponent(campaignId)}`)
        const sData = await resSessions.json().catch(() => ({}))
        const participants = new Map<string, { name?: string }>()
        for (const s of sData.sessions || []) {
          const arr = Array.isArray(s.participants) ? s.participants : []
          for (const p of arr) {
            const id = String(p?.userId)
            if (!participants.has(id)) participants.set(id, { name: p?.name })
          }
        }
        const resGold = await fetch(`/api/players/gold?campaignId=${encodeURIComponent(campaignId)}`)
        const gData = await resGold.json().catch(() => ({}))
        const goldMap = new Map<string, number>()
        for (const g of gData.rows || []) {
          goldMap.set(String(g.player_id), Number(g.gold_amount || 0))
        }
        const list: { player_id: string; name?: string; gold_amount: number }[] = []
        for (const [id, info] of participants.entries()) {
          list.push({ player_id: id, name: info.name, gold_amount: goldMap.get(id) ?? 0 })
        }
        setRows(list)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [campaignId])

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-200 flex items-center gap-2">
          <Coins className="w-4 h-4" /> Player Gold
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400">No players found in campaign sessions.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-400">Player</TableHead>
                <TableHead className="text-gray-400">Gold</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.player_id} className="border-gray-800">
                  <TableCell className="text-gray-200">{r.name || r.player_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-gray-200">
                    <Input
                      className="bg-gray-900 border-gray-700 text-white w-36"
                      value={goldEdits[r.player_id] ?? String(r.gold_amount)}
                      onChange={(e) => setGoldEdits({ ...goldEdits, [r.player_id]: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => onSetGold(r.player_id, Number(goldEdits[r.player_id] ?? r.gold_amount))}
                    >
                      <Shield className="w-4 h-4 mr-1" /> Save
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

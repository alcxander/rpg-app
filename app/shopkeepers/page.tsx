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
import { Plus, RefreshCw, ToggleRight, ShoppingCart, Loader2, Home, AlertTriangle } from "lucide-react"

type CampaignOption = { id: string; name: string; access_enabled?: boolean; owner_id?: string }

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

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  const [shopkeepers, setShopkeepers] = useState<Shopkeeper[]>([])
  const [campaignAccessEnabled, setCampaignAccessEnabled] = useState<boolean>(true)
  const [isOwner, setIsOwner] = useState<boolean>(false)

  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState(5)
  const [sessionId, setSessionId] = useState<string>("")

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
    const raw = String(errorRaw || "").slice(0, 4000)
    console.error("[shopkeepers.page] error", { title, raw })
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
            } catch {}
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
      console.log("[shopkeepers.page] load campaigns: start")
      try {
        const res = await fetch("/api/campaigns", { credentials: "include" })
        const { data, raw } = await parseJsonSafe(res)
        console.log("[shopkeepers.page] load campaigns: response", { ok: res.ok, status: res.status, len: raw.length })
        if (!res.ok) throw new Error(raw || "Failed to load campaigns")
        const list: CampaignOption[] = data.campaigns || []
        setCampaigns(list)
        if (!selectedCampaignId && list?.[0]?.id) {
          setSelectedCampaignId(list[0].id)
          console.log("[shopkeepers.page] default campaign set", { id: list[0].id })
        }
      } catch (e: any) {
        showError("Failed to load campaigns", String(e?.message || e))
      }
    })()
  }, [isLoaded, isSignedIn]) // eslint-disable-line

  // Load shopkeepers for a campaign
  const loadShopkeepers = async (cid: string) => {
    setLoading(true)
    console.log("[shopkeepers.page] load shopkeepers: start", { campaignId: cid })
    try {
      const res = await fetch(`/api/shopkeepers?campaignId=${encodeURIComponent(cid)}`, { credentials: "include" })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[shopkeepers.page] load shopkeepers: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Failed to load shopkeepers")
      setShopkeepers(data.shopkeepers || [])
      setCampaignAccessEnabled(Boolean(data.campaign?.access_enabled))
      setIsOwner(Boolean(data.campaign?.isOwner))
      console.log("[shopkeepers.page] load shopkeepers: set", {
        items: (data.shopkeepers || []).length,
        access: Boolean(data.campaign?.access_enabled),
        isOwner: Boolean(data.campaign?.isOwner),
      })
    } catch (e: any) {
      showError("Error loading shopkeepers", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedCampaignId) loadShopkeepers(selectedCampaignId)
  }, [selectedCampaignId]) // eslint-disable-line

  // Generate
  const onGenerate = async () => {
    if (!selectedCampaignId) return
    console.log("[shopkeepers.page] generate: start", { campaignId: selectedCampaignId, count })
    setGenerating(true)
    try {
      const res = await fetch("/api/shopkeepers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId: selectedCampaignId, count }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[shopkeepers.page] generate: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Generation failed")
      toast({ title: "Shopkeepers created", className: "bg-green-600 text-white" })
      await loadShopkeepers(selectedCampaignId)
    } catch (e: any) {
      showError("Generation error", String(e?.message || e))
    } finally {
      setGenerating(false)
      console.log("[shopkeepers.page] generate: end")
    }
  }

  // Toggle access
  const toggleAccess = async () => {
    if (!selectedCampaignId) return
    console.log("[shopkeepers.page] toggle access: start", {
      campaignId: selectedCampaignId,
      next: !campaignAccessEnabled,
    })
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaignId}/shop-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ access_enabled: !campaignAccessEnabled }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[shopkeepers.page] toggle access: response", { ok: res.ok, status: res.status, len: raw.length })
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

  // Auto-generate (server enforces permissions)
  const autoGenTriggered = useRef(false)
  const shouldAutoGenerate = useMemo(() => {
    const ag = search.get("autoGenerate")
    return ag === "1" || ag === "true"
  }, [search])

  useEffect(() => {
    if (!selectedCampaignId) return
    if (!shouldAutoGenerate) return
    if (autoGenTriggered.current) return
    const c = Number(search.get("count") || "")
    if (Number.isFinite(c) && c >= 5 && c <= 20) setCount(c)
    autoGenTriggered.current = true
    console.log("[shopkeepers.page] auto-generate: trigger", { campaignId: selectedCampaignId, count: c || count })
    onGenerate()
  }, [selectedCampaignId, shouldAutoGenerate]) // eslint-disable-line

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

          <TabsContent value="market" className="mt-4">
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
                                      onClick={() => {
                                        /* hook up PATCH when ready */
                                      }}
                                    >
                                      -1
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="bg-gray-700 text-white"
                                      onClick={() => {
                                        /* hook up PATCH when ready */
                                      }}
                                    >
                                      +1
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => {
                                      /* hook up purchase when ready */
                                    }}
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

          {/* Management and Players tabs omitted for brevity; unchanged in logic */}
          <TabsContent value="management" className="mt-4">
            {isOwner ? (
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
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}{" "}
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
            ) : (
              <p className="text-gray-400">Only the DM can access management.</p>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-4">
            <p className="text-gray-400">Only the DM can edit player gold.</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

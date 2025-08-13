"use client"

import { useUser, RedirectToSignIn } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { BattleForm } from "@/components/BattleForm"
import { LootForm } from "@/components/LootForm"
import { LootResults } from "@/components/LootResults"
import { LootHistory } from "@/components/LootHistory"
import { CanvasMap } from "@/components/CanvasMap"
import { Initiative } from "@/components/Initiative"
import { ChatMessages } from "@/components/ChatMessages"
import { TokenList } from "@/components/TokenList"
import { useRealtimeSession } from "@/hooks/useRealtimeSession"
import { useSessionChat } from "@/hooks/useSessionChat"
import type { CampaignOption, MapToken, BattleEntity } from "@/types"
import {
  Plus,
  RefreshCw,
  Loader2,
  Users,
  ShoppingBag,
  Sword,
  Dice6,
  Map,
  MessageSquare,
  Crown,
  UserPlus,
  Copy,
} from "lucide-react"

interface SessionState {
  id: string
  name: string
  campaign_id: string
  dm_id: string
  created_at: string
  background_image?: string
  map?: any
}

export default function HomePage() {
  const router = useRouter()
  const search = useSearchParams()
  const { isLoaded, isSignedIn, user } = useUser()
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [sessionName, setSessionName] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(false)
  const [battleEntities, setBattleEntities] = useState<BattleEntity[]>([])
  const [lootResults, setLootResults] = useState<any[]>([])
  const [showLootHistory, setShowLootHistory] = useState(false)

  // Realtime session hook
  const { session: realtimeSession, loading: sessionLoading, error: sessionError } = useRealtimeSession(sessionId)

  // Chat hook
  const { messages, sendMessage, isConnected } = useSessionChat(sessionId)

  // Safe map access
  const memoMap = useMemo(() => sessionState?.map ?? null, [sessionState?.map])

  // Convert a battle's monsters/allies into MapToken[] snapshot
  const tokensFromBattle = useCallback((battle: any): MapToken[] => {
    if (!battle?.entities) return []
    return battle.entities.map((ent: any) => ({
      id: ent.id,
      name: ent.name,
      x: ent.x || 0,
      y: ent.y || 0,
      imageUrl: ent.image_url || "",
      isPlayer: ent.type === "ally",
    }))
  }, [])

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
    console.error("[home.page] error", { title, raw })
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
      console.log("[home.page] load campaigns: start")
      try {
        const res = await fetch("/api/campaigns", { credentials: "include" })
        const { data, raw } = await parseJsonSafe(res)
        console.log("[home.page] load campaigns: response", { ok: res.ok, status: res.status, len: raw.length })
        if (!res.ok) throw new Error(raw || "Failed to load campaigns")
        const list: CampaignOption[] = data.campaigns || []
        setCampaigns(list)
        if (!selectedCampaignId && list?.[0]?.id) {
          setSelectedCampaignId(list[0].id)
          console.log("[home.page] default campaign set", { id: list[0].id })
        }
      } catch (e: any) {
        showError("Failed to load campaigns", String(e?.message || e))
      }
    })()
  }, [isLoaded, isSignedIn])

  // Auto-join session from URL
  useEffect(() => {
    const sid = search.get("sessionId")
    if (sid && sid !== sessionId) {
      console.log("[home.page] auto-join session from URL", { sessionId: sid })
      setSessionId(sid)
    }
  }, [search, sessionId])

  // Update session state when realtime session changes
  useEffect(() => {
    if (realtimeSession) {
      console.log("[home.page] updating session state from realtime", realtimeSession)
      setSessionState(realtimeSession)
      if (realtimeSession.campaign_id !== selectedCampaignId) {
        setSelectedCampaignId(realtimeSession.campaign_id)
      }
    }
  }, [realtimeSession, selectedCampaignId])

  // Create session
  const createSession = async () => {
    if (!selectedCampaignId || !sessionName.trim()) return
    setLoading(true)
    console.log("[home.page] create session: start", { campaignId: selectedCampaignId, name: sessionName })
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId: selectedCampaignId, name: sessionName.trim() }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[home.page] create session: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Failed to create session")
      const newSession = data.session
      setSessionId(newSession.id)
      setSessionState(newSession)
      setSessionName("")
      toast({ title: "Session created", className: "bg-green-600 text-white" })
    } catch (e: any) {
      showError("Failed to create session", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  // Join session
  const joinSession = async (sid: string) => {
    if (!sid.trim()) return
    console.log("[home.page] join session: start", { sessionId: sid })
    setSessionId(sid.trim())
    // The useRealtimeSession hook will handle loading the session data
  }

  // Leave session
  const leaveSession = () => {
    console.log("[home.page] leave session")
    setSessionId(null)
    setSessionState(null)
    setBattleEntities([])
    setLootResults([])
    router.push("/")
  }

  // Generate battle
  const generateBattle = async (battleData: any) => {
    if (!sessionId) return
    setLoading(true)
    console.log("[home.page] generate battle: start", { sessionId, battleData })
    try {
      const res = await fetch("/api/generate-battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, ...battleData }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[home.page] generate battle: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Failed to generate battle")
      setBattleEntities(data.entities || [])
      toast({ title: "Battle generated", className: "bg-green-600 text-white" })
    } catch (e: any) {
      showError("Failed to generate battle", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  // Generate loot
  const generateLoot = async (lootData: any) => {
    if (!sessionId) return
    setLoading(true)
    console.log("[home.page] generate loot: start", { sessionId, lootData })
    try {
      const res = await fetch("/api/generate-loot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, ...lootData }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[home.page] generate loot: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Failed to generate loot")
      setLootResults(data.loot || [])
      toast({ title: "Loot generated", className: "bg-green-600 text-white" })
    } catch (e: any) {
      showError("Failed to generate loot", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  // Generate map
  const generateMap = async () => {
    if (!sessionId) return
    setLoading(true)
    console.log("[home.page] generate map: start", { sessionId })
    try {
      const res = await fetch("/api/generate-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      })
      const { data, raw } = await parseJsonSafe(res)
      console.log("[home.page] generate map: response", { ok: res.ok, status: res.status, len: raw.length })
      if (!res.ok) throw new Error(raw || "Failed to generate map")
      // The map will be updated via the realtime session hook
      toast({ title: "Map generated", className: "bg-green-600 text-white" })
    } catch (e: any) {
      showError("Failed to generate map", String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  // Copy session link
  const copySessionLink = async () => {
    if (!sessionId) return
    const link = `${window.location.origin}/?sessionId=${sessionId}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: "Session link copied", className: "bg-green-600 text-white" })
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" })
    }
  }

  if (!isLoaded) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="ml-3 text-gray-400">Loading...</p>
      </div>
    )
  }
  if (!isSignedIn) return <RedirectToSignIn />

  const isInSession = !!sessionId && !!sessionState
  const isDM = sessionState?.dm_id === user?.id

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-purple-400">D&D Campaign Manager</h1>
            {isInSession && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/shopkeepers")}
              variant="secondary"
              className="bg-gray-800 border border-gray-700 text-white"
            >
              <ShoppingBag className="w-4 h-4 mr-2" /> Shopkeepers
            </Button>
            {isInSession && (
              <>
                <Button onClick={copySessionLink} variant="secondary" className="bg-gray-800 border border-gray-700">
                  <Copy className="w-4 h-4 mr-2" /> Copy Link
                </Button>
                <Button onClick={leaveSession} variant="secondary" className="bg-gray-800 border border-gray-700">
                  Leave Session
                </Button>
              </>
            )}
          </div>
        </div>

        {!isInSession ? (
          /* Session Management */
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Session */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300">Campaign</Label>
                  <Select value={selectedCampaignId || ""} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
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
                </div>
                <div>
                  <Label className="text-gray-300">Session Name</Label>
                  <Input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Enter session name"
                    className="bg-gray-900 border-gray-700 text-white"
                    onKeyDown={(e) => e.key === "Enter" && createSession()}
                  />
                </div>
                <Button
                  onClick={createSession}
                  disabled={loading || !selectedCampaignId || !sessionName.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Session
                </Button>
              </CardContent>
            </Card>

            {/* Join Session */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Join Existing Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300">Session ID</Label>
                  <Input
                    placeholder="Enter session ID"
                    className="bg-gray-900 border-gray-700 text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = e.target as HTMLInputElement
                        joinSession(target.value)
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Enter session ID"]') as HTMLInputElement
                    if (input) joinSession(input.value)
                  }}
                  disabled={sessionLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {sessionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Join Session
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Active Session */
          <div className="space-y-6">
            {/* Session Info */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isDM && <Crown className="w-5 h-5 text-yellow-500" />}
                    <span>{sessionState.name}</span>
                    <span className="text-sm text-gray-400">({sessionId})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>Campaign: {campaigns.find((c) => c.id === sessionState.campaign_id)?.name}</span>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            {sessionError && (
              <Card className="bg-red-900/20 border-red-700">
                <CardContent className="p-4">
                  <p className="text-red-300">Session Error: {sessionError}</p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="battle" className="w-full">
              <TabsList className="bg-gray-800">
                <TabsTrigger value="battle">
                  <Sword className="w-4 h-4 mr-2" />
                  Battle
                </TabsTrigger>
                <TabsTrigger value="loot">
                  <Dice6 className="w-4 h-4 mr-2" />
                  Loot
                </TabsTrigger>
                <TabsTrigger value="map">
                  <Map className="w-4 h-4 mr-2" />
                  Map
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat
                </TabsTrigger>
              </TabsList>

              {/* Battle Tab */}
              <TabsContent value="battle" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {isDM && <BattleForm onGenerate={generateBattle} loading={loading} />}
                    <Initiative entities={battleEntities} sessionId={sessionId} />
                  </div>
                  <TokenList entities={battleEntities} sessionId={sessionId} />
                </div>
              </TabsContent>

              {/* Loot Tab */}
              <TabsContent value="loot" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {isDM && <LootForm onGenerate={generateLoot} loading={loading} />}
                    <LootResults results={lootResults} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Loot History</h3>
                      <Switch checked={showLootHistory} onCheckedChange={setShowLootHistory} />
                    </div>
                    {showLootHistory && <LootHistory sessionId={sessionId} />}
                  </div>
                </div>
              </TabsContent>

              {/* Map Tab */}
              <TabsContent value="map" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Battle Map</h3>
                  {isDM && (
                    <Button onClick={generateMap} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Generate Map
                    </Button>
                  )}
                </div>
                <CanvasMap
                  sessionId={sessionId}
                  mapData={memoMap}
                  tokens={tokensFromBattle(battleEntities)}
                  isDM={isDM}
                />
              </TabsContent>

              {/* Chat Tab */}
              <TabsContent value="chat">
                <ChatMessages messages={messages} onSendMessage={sendMessage} isConnected={isConnected} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}

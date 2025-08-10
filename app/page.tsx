"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Swords, Gem, Store, MapIcon, Send, Plus, UserPlus, Copy, Hammer, Wand2, List } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUser, RedirectToSignIn, UserButton } from "@clerk/nextjs"
import { useRealtimeSession } from "@/hooks/useRealtimeSession"
import { useSessionChat } from "@/hooks/useSessionChat"
import { parseCoordinate } from "@/lib/utils"
import type { MapToken } from "@/lib/types"
import { ChatMessages } from "@/components/ChatMessages"
import { ChatLog } from "@/components/ChatLog"
import { TokenList } from "@/components/TokenList"
import { BattleForm } from "@/components/BattleForm"
import LootForm from "@/components/LootForm"
import Initiative from "@/components/Initiative"
import { useRouter } from "next/navigation"

const CanvasMap = dynamic(() => import("@/components/CanvasMap").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex-grow flex items-center justify-center bg-gray-900 rounded-lg">
      <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
      <p className="ml-4 text-lg text-gray-400">Loading map...</p>
    </div>
  ),
})

type CampaignOption = { id: string; name: string }
type SessionOption = { id: string; campaign_id: string }

export default function HomePage() {
  const { user, isLoaded, isSignedIn } = useUser()
  const userId = user?.id || null
  const router = useRouter()

  // Gate: ensure our DB user exists
  const [userReady, setUserReady] = useState(false)
  const [ensureUserError, setEnsureUserError] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [inputSessionId, setInputSessionId] = useState("")
  const [newCampaignName, setNewCampaignName] = useState("")
  const [inviteUserId, setInviteUserId] = useState("")

  const [isJoiningSession, setIsJoiningSession] = useState(false)
  const [showBattleForm, setShowBattleForm] = useState(false)
  const [showMapCanvas, setShowMapCanvas] = useState(false)

  const [showLlmResponseDialog, setShowLlmResponseDialog] = useState(false)
  const [llmResponseContent, setLlmResponseContent] = useState("")
  const [llmResponseTitle, setLlmResponseTitle] = useState("")

  const {
    sessionState,
    emitEvent,
    isLoading: sessionLoading,
    error: sessionError,
    moveTokenAndLog,
    setSessionState,
  } = useRealtimeSession(sessionId)
  const { messages: chatMessages, sendMessage } = useSessionChat(sessionId)
  const [sendingChat, setSendingChat] = useState(false)
  const { toast } = useToast()

  // Mobile overlays
  const [generatorsOpen, setGeneratorsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Token highlight
  const [highlightTokenId, setHighlightTokenId] = useState<string | null>(null)

  // Ensure user exists in our DB before rendering the app
  useEffect(() => {
    const run = async () => {
      if (!isLoaded || !isSignedIn) return
      setEnsureUserError(null)
      try {
        const res = await fetch("/api/ensure-user", { method: "POST" })
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error || "Failed to ensure user")
        }
        setUserReady(true)
      } catch (e: any) {
        setEnsureUserError(e.message || "Failed to ensure user")
        setUserReady(false)
      }
    }
    run()
  }, [isLoaded, isSignedIn])

  const handleJoinSession = useCallback(
    async (targetSessionId: string, targetUserId: string) => {
      setLlmResponseContent("")
      setLlmResponseTitle("")
      setShowLlmResponseDialog(false)

      if (!targetSessionId || !targetUserId) {
        toast({
          title: "Error",
          description: "Session ID and User ID are required.",
          variant: "destructive",
          className: "bg-red-600 text-white",
        })
        return
      }

      setIsJoiningSession(true)
      try {
        const response = await fetch("/api/join-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: targetSessionId }),
        })

        const json = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(json?.error || "Failed to join session.")
        }

        setSessionId(targetSessionId)
        toast({
          title: "Session Joined!",
          description: `You have joined session: ${targetSessionId}`,
          className: "bg-green-600 text-white",
        })
      } catch (error: any) {
        setSessionId(null)
        setLlmResponseTitle("Join Session Failed")
        setLlmResponseContent(error.message || "An unexpected error occurred.")
        setShowLlmResponseDialog(true)
        toast({
          title: "Failed to Join Session",
          description: error.message || "Unexpected error",
          variant: "destructive",
          className: "bg-red-600 text-white",
        })
      } finally {
        setIsJoiningSession(false)
      }
    },
    [toast],
  )

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campaigns", { method: "GET" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({
        title: "Error loading campaigns",
        description: data?.error || "Unknown error",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
      return
    }
    setCampaigns(data.campaigns || [])
    if (!selectedCampaignId && data.campaigns?.[0]) {
      setSelectedCampaignId(data.campaigns[0].id)
    }
  }, [selectedCampaignId, toast])

  const fetchSessions = useCallback(
    async (campaignId: string) => {
      const res = await fetch(`/api/sessions?campaignId=${encodeURIComponent(campaignId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Error loading sessions",
          description: data?.error || "Unknown error",
          variant: "destructive",
          className: "bg-red-600 text-white",
        })
        return
      }
      setSessions(data.sessions || [])
    },
    [toast],
  )

  useEffect(() => {
    if (isLoaded && isSignedIn && userReady) fetchCampaigns()
  }, [isLoaded, isSignedIn, userReady, fetchCampaigns])

  useEffect(() => {
    if (selectedCampaignId) fetchSessions(selectedCampaignId)
    else setSessions([])
  }, [selectedCampaignId, fetchSessions])

  useEffect(() => {
    if (!sessionLoading && sessionState.map) setShowMapCanvas(true)
  }, [sessionState, sessionLoading])

  const handleTokenMove = useCallback(
    (tokenId: string, x: number, y: number) => {
      // Only emit through the realtime channel; the session hook will append a single log entry.
      moveTokenAndLog(tokenId, x, y)
    },
    [moveTokenAndLog],
  )

  const memoMap = useMemo(() => sessionState.map ?? null, [sessionState.map])

  // Convert a battle's monsters/allies into MapToken[] snapshot
  const tokensFromBattle = useCallback((battle: any): MapToken[] => {
    const monsters: any[] = Array.isArray(battle?.monsters) ? battle.monsters : []
    const allies: any[] = Array.isArray(battle?.allies) ? battle.allies : []
    const toToken = (it: any, type: "monster" | "pc"): MapToken => {
      const coord = parseCoordinate(String(it.starting_coordinates || "A1"))
      return {
        id: String(it.id || `${type}-${Math.random().toString(36).slice(2)}`),
        type,
        name: String(it.name || (type === "monster" ? "Monster" : "PC")),
        image: String(it.image || ""),
        stats: typeof it.stats === "object" && it.stats ? it.stats : {},
        x: coord.x,
        y: coord.y,
      }
    }
    return [...monsters.map((m) => toToken(m, "monster")), ...allies.map((p) => toToken(p, "pc"))]
  }, [])

  const handleGenerateBattle = useCallback(
    async (formData: Parameters<NonNullable<React.ComponentProps<typeof BattleForm>["onGenerate"]>>[0]) => {
      if (!sessionId || !userId) {
        toast({
          title: "Error",
          description: "Join or create a session first.",
          variant: "destructive",
          className: "bg-red-600 text-white",
        })
        return
      }
      try {
        const response = await fetch("/api/generate-battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, sessionId, userId }),
        })

        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          setLlmResponseTitle("Battle Generation Failed")
          setLlmResponseContent(body.error || "An unknown error occurred.")
          setShowLlmResponseDialog(true)
          throw new Error(body.error || "Failed to generate battle.")
        }

        // Optimistic update
        setSessionState((prev) => {
          const battle = body.battle
          const map = body.map
          const updatedBattles = [battle, ...prev.battles]
          const nextMap = {
            ...(prev.map || map),
            tokens: map.tokens,
            background_image: map.background_image ?? prev.map?.background_image ?? null,
            updated_at: new Date().toISOString(),
          }
          return {
            ...prev,
            battles: updatedBattles,
            battle,
            map: nextMap,
            chatLog: (battle.log || []).map(String),
          }
        })

        // Broadcast to others
        emitEvent({ type: "UPDATE_MAP", payload: body.map })
        emitEvent({ type: "UPDATE_BATTLE", payload: body.battle })
        emitEvent({ type: "ADD_CHAT_MESSAGE", payload: body.battle.log?.[0] || "Battle generated." })

        setShowMapCanvas(true)
        toast({
          title: "Battle Generated",
          description: `Created "${body.battle?.name || "New Battle"}"`,
          className: "bg-green-600 text-white",
        })
      } catch (error: any) {
        toast({
          title: "Generation Error",
          description: String(error?.message || "Failed to generate battle"),
          variant: "destructive",
          className: "bg-red-600 text-white",
        })
      }
    },
    [sessionId, userId, toast, emitEvent, setSessionState],
  )

  // Switch to a battle: apply its snapshot to the map and set chat log
  const onSelectBattle = (battleId: string) => {
    const b: any = sessionState.battles.find((x) => x.id === battleId) || null
    if (!b) return
    const tokens = tokensFromBattle(b)
    setSessionState((prev) => ({
      ...prev,
      battle: b,
      map: prev.map
        ? {
            ...prev.map,
            tokens,
            background_image: (b as any).background_image ?? prev.map.background_image ?? null,
            updated_at: new Date().toISOString(),
          }
        : prev.map,
      chatLog: (b?.log || []).map(String),
    }))
  }

  const currentMonsters = sessionState.map?.tokens.filter((t) => t.type === "monster") || []
  const currentPCs = sessionState.map?.tokens.filter((t) => t.type === "pc") || []

  const onCreateCampaign = async () => {
    const name = newCampaignName.trim()
    if (!name) return
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setNewCampaignName("")
      await fetchCampaigns()
      if (data.campaign?.id) {
        setSelectedCampaignId(data.campaign.id)
        await fetchSessions(data.campaign.id)
      }
      toast({ title: "Campaign Created", className: "bg-green-600 text-white" })
    } else {
      toast({
        title: "Error",
        description: data.error || "Failed to create campaign",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
    }
  }

  const onCreateSession = async () => {
    if (!selectedCampaignId || !inputSessionId.trim()) return
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: selectedCampaignId, sessionId: inputSessionId.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setInputSessionId("")
      await fetchSessions(selectedCampaignId)
      toast({ title: "Session Created", className: "bg-green-600 text-white" })
    } else {
      toast({
        title: "Error",
        description: data.error || "Failed to create session",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
    }
  }

  const onInvite = async () => {
    if (!selectedCampaignId || !inviteUserId.trim()) return
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: selectedCampaignId,
        userIdToInvite: inviteUserId.trim(),
        name: user?.primaryEmailAddress?.toString() || "Guest",
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setInviteUserId("")
      await fetchSessions(selectedCampaignId)
      toast({
        title: "Player Invited",
        description: "They now have access to this campaign’s sessions.",
        className: "bg-green-600 text-white",
      })
    } else {
      toast({
        title: "Invite Failed",
        description: data.error || "Unable to invite user",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
    }
  }

  const [chatInput, setChatInput] = useState("")
  const onSendChat = async () => {
    const msg = chatInput.trim()
    if (!msg) return
    try {
      setSendingChat(true)
      await sendMessage(msg)
      setChatInput("")
    } catch (e: any) {
      toast({
        title: "Chat Failed",
        description: e.message || "Unable to send message",
        variant: "destructive",
        className: "bg-red-600 text-white",
      })
    } finally {
      setSendingChat(false)
    }
  }

  const copyUserId = async () => {
    if (!userId) return
    await navigator.clipboard.writeText(userId)
    toast({
      title: "Copied",
      description: "Your user ID was copied to clipboard",
      className: "bg-green-600 text-white",
    })
  }

  const [dmMenuOpen, setDmMenuOpen] = useState(false)

  if (!isLoaded) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <p className="ml-4 text-lg text-gray-400">Loading user data...</p>
      </div>
    )
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  if (!userReady) {
    return (
      <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Setting up your account...</h1>
        <p className="text-gray-400 max-w-md mb-4">
          We’re linking your profile to the game database, if you're seeing this sorry just gotta link your profile
          across systems. It drops sometimes. You must exist in our database to use the app.
        </p>
        {ensureUserError && <p className="text-red-400 text-sm mb-2">{ensureUserError}</p>}
        <Button onClick={() => location.reload()} className="bg-purple-600 hover:bg-purple-700 text-white">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-purple-500">RPG Nexus</h1>

          {/* Desktop DM Tools */}
          <DropdownMenu open={dmMenuOpen} onOpenChange={setDmMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                onMouseEnter={() => setDmMenuOpen(true)}
                onMouseLeave={() => setDmMenuOpen(false)}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 inline-flex items-center gap-2 hidden sm:inline-flex"
              >
                <Hammer className="w-4 h-4" /> DM Tools
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onMouseEnter={() => setDmMenuOpen(true)}
              onMouseLeave={() => setDmMenuOpen(false)}
              className="bg-gray-800 text-white border-gray-700"
            >
              <DropdownMenuItem onClick={() => setShowBattleForm(true)} className="focus:bg-gray-700">
                <Swords className="w-4 h-4 mr-2" /> Generate Battle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGeneratorsOpen(true)} className="focus:bg-gray-700">
                <Wand2 className="w-4 h-4 mr-2" /> Generate Loot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/shopkeepers")} className="focus:bg-gray-700">
                <Store className="w-4 h-4 mr-2" /> Shopkeepers
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/shopkeepers?autoGenerate=1")}
                className="focus:bg-gray-700"
              >
                <Store className="w-4 h-4 mr-2" /> Generate Shopkeepers Now
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="focus:bg-gray-700">
                <Gem className="w-4 h-4 mr-2" /> Generate Loot (Soon)
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="focus:bg-gray-700">
                <MapIcon className="w-4 h-4 mr-2" /> Generate Map (Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile actions */}
          <div className="sm:hidden flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-gray-700 text-white border-gray-600"
              onClick={() => setGeneratorsOpen(true)}
              title="Generators"
            >
              <Wand2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-gray-700 text-white border-gray-600"
              onClick={() => setDetailsOpen(true)}
              title="Details"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-gray-300 hidden sm:block">
            {user?.fullName || user?.primaryEmailAddress?.toString() || "Guest"} ({userId?.substring(0, 8)})
          </span>
          <Button
            variant="secondary"
            size="icon"
            className="bg-gray-700 text-white border-gray-600"
            onClick={copyUserId}
            title="Copy your user ID"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar (hidden on mobile) */}
          <aside className="hidden md:flex w-[380px] p-4 border-r border-gray-700 bg-gray-800 flex-col space-y-4 overflow-y-auto">
            <h2 className="text-xl font-semibold text-purple-400">Campaign & Session</h2>

            <div className="space-y-3">
              <Label className="text-gray-300">Select Campaign</Label>
              <div className="flex gap-2 items-center">
                <Select value={selectedCampaignId || ""} onValueChange={(v) => setSelectedCampaignId(v)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Choose campaign" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 max-h-64">
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="New campaign name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button
                  onClick={onCreateCampaign}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  title="Create campaign"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Label className="text-gray-300">Select Session</Label>
              <div className="flex gap-2 items-center">
                <Select value={sessionId || ""} onValueChange={(v) => setSessionId(v)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Choose session" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 max-h-64">
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="New session id"
                  value={inputSessionId}
                  onChange={(e) => setInputSessionId(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button
                  onClick={onCreateSession}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  title="Create session"
                  disabled={!selectedCampaignId || !inputSessionId.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => userId && sessionId && handleJoinSession(sessionId, userId)}
                  disabled={isJoiningSession || !sessionId || !userId}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isJoiningSession ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join Selected"}
                </Button>
                <Input
                  placeholder="Invite user id (clerk)"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button
                  onClick={onInvite}
                  disabled={!selectedCampaignId || !inviteUserId.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  title="Invite player to campaign"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>

              {sessionId && (
                <p className="text-sm text-gray-400">
                  Active Session: <span className="font-mono text-purple-300">{sessionId}</span>
                </p>
              )}
              {sessionError && <p className="text-sm text-red-400">Error: {sessionError}</p>}
            </div>

            {/* Chat */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-300">Chat</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button
                  onClick={onSendChat}
                  className="bg-gray-700 hover:bg-gray-600 text-white"
                  disabled={!sessionId || !chatInput.trim() || sendingChat}
                >
                  {sendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <ChatMessages messages={chatMessages} me={userId} />
            </div>
          </aside>

          {/* Map section */}
          <section className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
            {sessionLoading ? (
              <div className="flex-grow flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                <p className="ml-4 text-lg text-gray-400">Loading session data...</p>
              </div>
            ) : showMapCanvas ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <CanvasMap
                    mapData={memoMap}
                    isDM={true}
                    onTokenMove={handleTokenMove}
                    highlightTokenId={highlightTokenId}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-grow flex items-center justify-center bg-gray-900 rounded-lg">
                <p className="text-gray-400 text-lg text-center">
                  Select or create a session on the left, then join it. Use DM Tools to generate a battle.
                </p>
              </div>
            )}
          </section>

          {/* Right sidebar (hidden on mobile) */}
          <aside className="hidden lg:flex w-[340px] p-4 border-l border-gray-700 bg-gray-800 flex-col space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-purple-400">Current Battle</h2>
              </div>
              <div className="flex items-center gap-2 max-w-60">
                <Label className="text-gray-300">Battles</Label>
                <Select value={sessionState.battle?.id || ""} onValueChange={onSelectBattle}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full max-w-full">
                    <SelectValue placeholder="Select battle" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 max-h-64">
                    {sessionState.battles.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex w-full min-w-0 items-center">
                          <span className="truncate max-w-[240px]">
                            {(b as any).name ? `${(b as any).name}` : "Battle"} —{" "}
                            {new Date(b.created_at).toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Initiative above TokenList */}
            <Initiative
              battle={sessionState.battle || null}
              tokens={sessionState.map?.tokens || []}
              onHighlightToken={(id) => setHighlightTokenId(id)}
            />

            <TokenList monsters={currentMonsters} pcs={currentPCs} onHoverToken={(id) => setHighlightTokenId(id)} />

            <div className="h-64">
              <ChatLog messages={sessionState.chatLog} title="Activity Log" />
            </div>
          </aside>
        </div>
      </main>

      {/* Generators Dialog (mobile-friendly) */}
      <Dialog open={generatorsOpen} onOpenChange={setGeneratorsOpen}>
        <DialogContent className="sm:max-w-[680px] bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-purple-400">Generators</DialogTitle>
            <DialogDescription className="text-gray-400">Tools to create content quickly.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="loot" className="w-full">
            <TabsList className="bg-gray-700">
              <TabsTrigger value="loot">Loot</TabsTrigger>
              <TabsTrigger value="battle">Battle</TabsTrigger>
            </TabsList>
            <TabsContent value="loot" className="pt-4">
              <LootForm sessionId={sessionId} />
            </TabsContent>
            <TabsContent value="battle" className="pt-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-300">Use the battle generator to create a balanced encounter and map.</p>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setShowBattleForm(true)}
                >
                  <Swords className="w-4 h-4 mr-2" /> Open Battle Generator
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button onClick={() => setGeneratorsOpen(false)} className="bg-gray-700 text-white border border-gray-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog (mobile-friendly: current battle, tokens, activity log) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[680px] bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-purple-400">Battle Details</DialogTitle>
            <DialogDescription className="text-gray-400">Quick access on small screens.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-gray-300">Battles</Label>
              <Select value={sessionState.battle?.id || ""} onValueChange={onSelectBattle}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full max-w-full">
                  <SelectValue placeholder="Select battle" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 max-h-64">
                  {sessionState.battles.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex w-full min-w-0 items-center">
                        <span className="truncate max-w-[240px]">
                          {(b as any).name ? `${(b as any).name}` : "Battle"} —{" "}
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Initiative above TokenList in details dialog */}
            <Initiative
              battle={sessionState.battle || null}
              tokens={sessionState.map?.tokens || []}
              onHighlightToken={(id) => setHighlightTokenId(id)}
            />

            <TokenList monsters={currentMonsters} pcs={currentPCs} onHoverToken={(id) => setHighlightTokenId(id)} />

            <div className="h-64">
              <ChatLog messages={sessionState.chatLog} title="Activity Log" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setDetailsOpen(false)} className="bg-gray-700 text-white border border-gray-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error/Response dialog */}
      <Dialog open={showLlmResponseDialog} onOpenChange={setShowLlmResponseDialog}>
        <DialogContent className="sm:max-w-[600px] bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-purple-400">{llmResponseTitle}</DialogTitle>
            <DialogDescription className="text-gray-400">Details of the response or error.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto p-4 bg-gray-700 rounded-md text-sm font-mono text-gray-200">
            <pre className="whitespace-pre-wrap break-words">{llmResponseContent}</pre>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowLlmResponseDialog(false)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Battle Form dialog (shared desktop/mobile) */}
      {true && (
        <BattleForm
          isOpen={showBattleForm}
          onClose={() => setShowBattleForm(false)}
          onGenerate={handleGenerateBattle}
        />
      )}
    </div>
  )
}

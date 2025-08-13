"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Users, Settings, Play, Crown, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface Campaign {
  id: string
  name: string
  owner_id: string
  created_at: string
  is_owner: boolean
  is_member: boolean
  member_role?: string
}

interface Session {
  id: string
  campaign_id: string
  active: boolean
  participants: string[]
  created_at: string
  updated_at: string
}

export default function HomePage() {
  const { user, isLoaded } = useUser()
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New campaign form
  const [newCampaignName, setNewCampaignName] = useState("")
  const [creatingCampaign, setCreatingCampaign] = useState(false)

  // New session form
  const [newSessionId, setNewSessionId] = useState("default-rpg-session")
  const [creatingSession, setCreatingSession] = useState(false)

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("[HomePage] Fetching campaigns...")
      const response = await fetch("/api/campaigns")

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log("[HomePage] Campaigns response:", data)

      const campaignList = data.campaigns || []
      setCampaigns(campaignList)

      // Auto-select first campaign if none selected
      if (campaignList.length > 0 && !selectedCampaign) {
        setSelectedCampaign(campaignList[0].id)
      }

      console.log("[HomePage] Campaigns loaded:", {
        count: campaignList.length,
        selected: selectedCampaign || campaignList[0]?.id,
      })
    } catch (err) {
      console.error("[HomePage] Error fetching campaigns:", err)
      setError(err instanceof Error ? err.message : "Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async (campaignId: string) => {
    if (!campaignId) return

    try {
      setSessionsLoading(true)
      console.log("[HomePage] Fetching sessions for campaign:", campaignId)

      const response = await fetch(`/api/sessions?campaignId=${campaignId}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log("[HomePage] Sessions response:", data)

      setSessions(data.sessions || [])
    } catch (err) {
      console.error("[HomePage] Error fetching sessions:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load sessions",
        variant: "destructive",
      })
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded && user) {
      fetchCampaigns()
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (selectedCampaign) {
      fetchSessions(selectedCampaign)
    }
  }, [selectedCampaign])

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCampaignName.trim()) return

    try {
      setCreatingCampaign(true)
      console.log("[HomePage] Creating campaign:", newCampaignName)

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCampaignName.trim() }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create campaign")
      }

      const data = await response.json()
      console.log("[HomePage] Campaign created:", data)

      toast({
        title: "Success",
        description: `Campaign "${newCampaignName}" created successfully!`,
      })

      setNewCampaignName("")
      await fetchCampaigns()

      // Auto-select the new campaign
      if (data.campaign?.id) {
        setSelectedCampaign(data.campaign.id)
      }
    } catch (err) {
      console.error("[HomePage] Error creating campaign:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create campaign",
        variant: "destructive",
      })
    } finally {
      setCreatingCampaign(false)
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampaign || !newSessionId.trim()) return

    try {
      setCreatingSession(true)
      console.log("[HomePage] Creating session:", { sessionId: newSessionId, campaignId: selectedCampaign })

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaign,
          sessionId: newSessionId.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create session")
      }

      const data = await response.json()
      console.log("[HomePage] Session created:", data)

      toast({
        title: "Success",
        description: `Session "${newSessionId}" created successfully!`,
      })

      setNewSessionId("default-rpg-session")
      await fetchSessions(selectedCampaign)
    } catch (err) {
      console.error("[HomePage] Error creating session:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create session",
        variant: "destructive",
      })
    } finally {
      setCreatingSession(false)
    }
  }

  const handleJoinSession = async (sessionId: string) => {
    try {
      console.log("[HomePage] Joining session:", sessionId)

      const response = await fetch("/api/join-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to join session")
      }

      const data = await response.json()
      console.log("[HomePage] Joined session:", data)

      toast({
        title: "Success",
        description: data.message || "Joined session successfully!",
      })

      // Redirect to session
      window.location.href = `/session/${sessionId}`
    } catch (err) {
      console.error("[HomePage] Error joining session:", err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to join session",
        variant: "destructive",
      })
    }
  }

  const getCampaignBadge = (campaign: Campaign) => {
    if (campaign.is_owner) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      )
    } else if (campaign.is_member) {
      const role = campaign.member_role || "Player"
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          {role === "DM" ? <Shield className="h-3 w-3" /> : <Users className="h-3 w-3" />}
          {role}
        </Badge>
      )
    }
    return null
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to RPG Manager</h1>
          <p className="text-gray-400 mb-8">Please sign in to continue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">RPG Manager</h1>
            <p className="text-gray-400">Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-400">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              <span>Loading campaigns...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error Loading Campaigns</h3>
              <p className="text-red-300 mb-4">{error}</p>
              <Button
                onClick={fetchCampaigns}
                variant="outline"
                className="border-red-600 text-red-400 hover:bg-red-900/30 bg-transparent"
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Campaigns */}
            <div className="lg:col-span-1">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Campaigns
                  </CardTitle>
                  <CardDescription>Select a campaign to manage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Campaign List */}
                  <div className="space-y-2">
                    {campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedCampaign === campaign.id
                            ? "bg-purple-900/30 border-purple-600"
                            : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                        }`}
                        onClick={() => setSelectedCampaign(campaign.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{campaign.name}</h3>
                            <p className="text-sm text-gray-400">
                              Created {new Date(campaign.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="ml-2 flex flex-col items-end gap-1">
                            {getCampaignBadge(campaign)}
                            {(campaign.is_owner || campaign.member_role === "DM") && (
                              <Link href={`/campaigns/${campaign.id}/settings`}>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Create Campaign Form */}
                  <form onSubmit={handleCreateCampaign} className="space-y-3 pt-4 border-t border-gray-700">
                    <Label htmlFor="campaignName">Create New Campaign</Label>
                    <Input
                      id="campaignName"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="Enter campaign name"
                      className="bg-gray-700 border-gray-600"
                    />
                    <Button
                      type="submit"
                      disabled={!newCampaignName.trim() || creatingCampaign}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {creatingCampaign ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Campaign
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Content - Sessions */}
            <div className="lg:col-span-2">
              {selectedCampaign ? (
                <Tabs defaultValue="sessions" className="space-y-6">
                  <TabsList className="bg-gray-800">
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="shopkeepers">Shopkeepers</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sessions" className="space-y-6">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle>Game Sessions</CardTitle>
                        <CardDescription>
                          {sessions.length} session{sessions.length !== 1 ? "s" : ""} in this campaign
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {sessionsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="flex items-center gap-3">
                              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                              <span>Loading sessions...</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Sessions List */}
                            <div className="space-y-3">
                              {sessions.map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                                >
                                  <div>
                                    <h3 className="font-medium">{session.id}</h3>
                                    <p className="text-sm text-gray-400">
                                      {session.participants.length} participant
                                      {session.participants.length !== 1 ? "s" : ""}
                                      {session.active && <Badge className="ml-2 bg-green-600">Active</Badge>}
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => handleJoinSession(session.id)}
                                    className="bg-purple-600 hover:bg-purple-700"
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Join Session
                                  </Button>
                                </div>
                              ))}
                              {sessions.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                  <p>No sessions yet. Create one to get started!</p>
                                </div>
                              )}
                            </div>

                            {/* Create Session Form */}
                            <form onSubmit={handleCreateSession} className="space-y-3 pt-4 border-t border-gray-700">
                              <Label htmlFor="sessionId">Create New Session</Label>
                              <Input
                                id="sessionId"
                                value={newSessionId}
                                onChange={(e) => setNewSessionId(e.target.value)}
                                placeholder="Enter session ID"
                                className="bg-gray-700 border-gray-600"
                              />
                              <Button
                                type="submit"
                                disabled={!selectedCampaign || !newSessionId.trim() || creatingSession}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                              >
                                {creatingSession ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Session
                                  </>
                                )}
                              </Button>
                            </form>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="shopkeepers">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle>Shopkeepers</CardTitle>
                        <CardDescription>Manage NPCs and shops for this campaign</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8 text-gray-400">
                          <p>Shopkeepers integration coming soon...</p>
                          <Link href={`/shopkeepers?campaignId=${selectedCampaign}`}>
                            <Button className="mt-4 bg-purple-600 hover:bg-purple-700">View Shopkeepers</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center text-gray-400">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a campaign to view its sessions and resources</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

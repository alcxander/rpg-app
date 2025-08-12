"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, Settings, Loader2, Trash2, Crown, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"

interface CampaignMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  users: {
    id: string
    name: string
    clerk_id: string
  }
}

interface Campaign {
  id: string
  name: string
  owner_id: string
}

export default function CampaignSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCampaignData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch campaign details
      const campaignRes = await fetch(`/api/campaigns/${campaignId}`)
      if (!campaignRes.ok) {
        throw new Error("Failed to fetch campaign")
      }
      const campaignData = await campaignRes.json()
      setCampaign(campaignData)

      // Fetch members
      const membersRes = await fetch(`/api/campaigns/${campaignId}/members`)
      if (!membersRes.ok) {
        throw new Error("Failed to fetch members")
      }
      const membersData = await membersRes.json()
      setMembers(membersData.members || [])
    } catch (err) {
      console.error("Error fetching campaign data:", err)
      setError(err instanceof Error ? err.message : "Failed to load campaign")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (campaignId) {
      fetchCampaignData()
    }
  }, [campaignId])

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this campaign?`)) {
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/members?userId=${memberUserId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove member")
      }

      toast({
        title: "Success",
        description: `${memberName} has been removed from the campaign`,
      })

      // Refresh members list
      fetchCampaignData()
    } catch (error) {
      console.error("Error removing member:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "Owner":
        return <Crown className="h-4 w-4" />
      case "DM":
        return <Shield className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Owner":
        return "default"
      case "DM":
        return "secondary"
      default:
        return "outline"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <span className="text-lg">Loading campaign settings...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={() => router.push("/")} className="bg-purple-600 hover:bg-purple-700">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => router.push("/")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign?.name}</h1>
            <p className="text-gray-400">Campaign Settings</p>
          </div>
        </div>

        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <InviteUserForm campaignId={campaignId} onInviteSuccess={fetchCampaignData} />

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Current Members
                  </CardTitle>
                  <CardDescription>
                    {members.length} member{members.length !== 1 ? "s" : ""} in this campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getRoleIcon(member.role)}
                          <div>
                            <p className="font-medium">{member.users.name}</p>
                            <p className="text-sm text-gray-400">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                          {member.role !== "Owner" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMember(member.user_id, member.users.name)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No members yet. Invite some players to get started!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
                <CardDescription>Configure your campaign preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">Campaign settings coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

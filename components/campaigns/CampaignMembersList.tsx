"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, User, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CampaignMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  users: {
    id: string
    name: string | null
    email: string | null
    image_url: string | null
  }
}

interface CampaignMembersListProps {
  campaignId: string
  refreshTrigger?: number
}

export function CampaignMembersList({ campaignId, refreshTrigger = 0 }: CampaignMembersListProps) {
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchMembers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/members`)

      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error("Error fetching members:", error)
      toast({
        title: "Error",
        description: "Failed to load campaign members",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [campaignId, refreshTrigger])

  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading members...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Campaign Members ({members.length})
        </CardTitle>
        <CardDescription>Players and dungeon masters in this campaign</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No members yet</p>
            <p className="text-sm">Invite players to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.users.image_url || undefined} />
                    <AvatarFallback>{getInitials(member.users.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.users.name || "Unknown User"}</div>
                    <div className="text-sm text-muted-foreground">{member.users.email}</div>
                    <div className="text-xs text-muted-foreground">Joined {formatDate(member.joined_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === "DM" ? "default" : "secondary"}>
                    {member.role === "DM" ? (
                      <>
                        <Crown className="h-3 w-3 mr-1" />
                        DM
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3 mr-1" />
                        Player
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

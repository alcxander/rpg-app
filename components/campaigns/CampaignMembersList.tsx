"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CampaignMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  users: {
    id: string
    email: string
    name?: string
    avatar_url?: string
  }
}

interface CampaignMembersListProps {
  campaignId: string
  refreshTrigger?: number
}

export function CampaignMembersList({ campaignId, refreshTrigger }: CampaignMembersListProps) {
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/members`)

      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (error: any) {
      console.error("Failed to fetch members:", error)
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

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return "U"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Campaign Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Campaign Members
        </CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? "member" : "members"} in this campaign
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No members found</p>
              <p className="text-sm">Invite players to get started</p>
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.users.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(member.users.name, member.users.email)}</AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.users.name || member.users.email}</p>
                      <Badge variant={member.role === "DM" ? "default" : "secondary"} className="text-xs">
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
                    <p className="text-sm text-muted-foreground">{member.users.email}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(member.joined_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

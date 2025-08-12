"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  user?: {
    id: string
    name?: string
    email?: string
    avatar_url?: string
  }
}

interface CampaignMembersListProps {
  campaignId: string
  refreshTrigger?: number
}

export function CampaignMembersList({ campaignId, refreshTrigger }: CampaignMembersListProps) {
  const [members, setMembers] = useState<Member[]>([])
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
      setMembers(Array.isArray(data) ? data : [])
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "DM":
        return <Crown className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "DM":
        return "default" as const
      default:
        return "secondary" as const
    }
  }

  const getInitials = (name?: string, email?: string, userId?: string) => {
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
    if (userId) {
      return userId.slice(0, 2).toUpperCase()
    }
    return "?"
  }

  const getDisplayName = (member: Member) => {
    if (member.user?.name) return member.user.name
    if (member.user?.email) return member.user.email
    return member.user_id
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
            <div className="text-muted-foreground">Loading members...</div>
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
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No members found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user?.avatar_url || "/placeholder.svg"} alt={getDisplayName(member)} />
                    <AvatarFallback>
                      {getInitials(member.user?.name, member.user?.email, member.user_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{getDisplayName(member)}</div>
                    {member.user?.email && member.user.name && (
                      <div className="text-sm text-muted-foreground">{member.user.email}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                  {getRoleIcon(member.role)}
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

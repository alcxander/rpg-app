"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Crown, Shield, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CampaignMember {
  id: string
  user_id: string
  role: "Owner" | "DM" | "Player"
  joined_at: string
  added_by?: string
  users?: {
    id: string
    email?: string
    name?: string
    image_url?: string
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
      setMembers(data)
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "Owner":
        return <Crown className="h-4 w-4" />
      case "DM":
        return <Shield className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Owner":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "DM":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
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
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members found. Start by inviting some players!
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={member.users?.image_url || "/placeholder.svg"}
                      alt={member.users?.name || member.user_id}
                    />
                    <AvatarFallback>
                      {member.users?.name?.charAt(0) || member.user_id.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.users?.name || member.user_id}</div>
                    {member.users?.email && <div className="text-sm text-muted-foreground">{member.users.email}</div>}
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={getRoleColor(member.role)}>
                  <span className="flex items-center gap-1">
                    {getRoleIcon(member.role)}
                    {member.role}
                  </span>
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

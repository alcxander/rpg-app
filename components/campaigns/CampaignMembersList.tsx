"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, Crown, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
      case "Player":
        return <Shield className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "DM":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Player":
        return "bg-blue-100 text-blue-800 border-blue-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
          {members.length} member{members.length !== 1 ? "s" : ""} in this campaign
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{member.users.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.users.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`flex items-center gap-1 ${getRoleColor(member.role)}`}>
                {getRoleIcon(member.role)}
                {member.role}
              </Badge>
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No members yet. Invite some players to get started!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

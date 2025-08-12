"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Users, Crown, User, Loader2 } from "lucide-react"

interface CampaignMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  users: {
    id: string
    name: string
    email?: string
    image_url?: string
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
      console.error("Fetch members error:", error)
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
    return role === "DM" ? <Crown className="h-4 w-4" /> : <User className="h-4 w-4" />
  }

  const getRoleVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    return role === "DM" ? "default" : "secondary"
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
        <CardDescription>Players and DMs in this campaign</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members found. Start by inviting some players!
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.users.image_url || "/placeholder.svg"} alt={member.users.name || "User"} />
                    <AvatarFallback>
                      {(member.users.name || member.users.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.users.name || member.users.email || "Unknown User"}</div>
                    <div className="text-sm text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Badge variant={getRoleVariant(member.role)} className="flex items-center gap-1">
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

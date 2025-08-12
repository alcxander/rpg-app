"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, UserPlus } from "lucide-react"

interface InviteUserFormProps {
  campaignId: string
  onInviteSuccess?: () => void
}

export function InviteUserForm({ campaignId, onInviteSuccess }: InviteUserFormProps) {
  const [inviteeId, setInviteeId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inviteeId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a user ID",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteeId: inviteeId.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite user")
      }

      if (data.already_member) {
        toast({
          title: "Already a member",
          description: data.message || "This user is already a member of the campaign",
        })
      } else {
        toast({
          title: "Success!",
          description: data.message || "User has been invited to the campaign",
        })
        setInviteeId("")
        onInviteSuccess?.()
      }
    } catch (error) {
      console.error("Invite error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to invite user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Players
        </CardTitle>
        <CardDescription>Add new players to your campaign by entering their user ID</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteeId">User ID</Label>
            <Input
              id="inviteeId"
              type="text"
              placeholder="Enter user ID (e.g., user_abc123)"
              value={inviteeId}
              onChange={(e) => setInviteeId(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !inviteeId.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Player
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

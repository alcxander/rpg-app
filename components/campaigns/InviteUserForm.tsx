"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface InviteUserFormProps {
  campaignId: string
  onInviteSuccess?: () => void
}

export function InviteUserForm({ campaignId, onInviteSuccess }: InviteUserFormProps) {
  const [userIdToInvite, setUserIdToInvite] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const { toast } = useToast()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userIdToInvite.trim()) {
      toast({
        title: "Error",
        description: "Please enter a user ID to invite",
        variant: "destructive",
      })
      return
    }

    setIsInviting(true)

    try {
      console.log("[InviteUserForm] Inviting user", { campaignId, userIdToInvite: userIdToInvite.trim() })

      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          userIdToInvite: userIdToInvite.trim(),
          name: "Invited User", // This field is not used anymore but kept for compatibility
        }),
      })

      const data = await response.json()
      console.log("[InviteUserForm] Invite response", { status: response.status, data })

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite user")
      }

      toast({
        title: "Success",
        description: data.message || "User invited successfully!",
      })

      setUserIdToInvite("")
      onInviteSuccess?.()
    } catch (error) {
      console.error("[InviteUserForm] Invite error", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to invite user",
        variant: "destructive",
      })
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Player
        </CardTitle>
        <CardDescription>Add a new player to this campaign by their user ID</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <Label htmlFor="userIdToInvite">User ID (Clerk ID)</Label>
            <Input
              id="userIdToInvite"
              value={userIdToInvite}
              onChange={(e) => setUserIdToInvite(e.target.value)}
              placeholder="user_2ABC123DEF456GHI789"
              className="bg-gray-700 border-gray-600 text-white"
              disabled={isInviting}
            />
            <p className="text-sm text-gray-400 mt-1">Enter the Clerk user ID (starts with "user_")</p>
          </div>

          <Button
            type="submit"
            disabled={!userIdToInvite.trim() || isInviting}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isInviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h4 className="font-medium mb-2">How to find a User ID:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
            <li>Ask the user to copy their ID from the main page (copy button next to their name)</li>
            <li>Or check your Clerk Dashboard → Users section</li>
            <li>User IDs start with "user_" followed by random characters</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

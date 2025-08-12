"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface InviteUserFormProps {
  campaignId: string
  onInviteSuccess?: () => void
}

export function InviteUserForm({ campaignId, onInviteSuccess }: InviteUserFormProps) {
  const [userIdToInvite, setUserIdToInvite] = useState("")
  const [role, setRole] = useState("Player")
  const [isInviting, setIsInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null)
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
    setInviteResult(null)

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIdToInvite: userIdToInvite.trim(),
          role,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setInviteResult({
          success: true,
          message: data.message || "User invited successfully!",
        })
        setUserIdToInvite("")
        setRole("Player")

        toast({
          title: "Success",
          description: data.message || "User invited successfully!",
        })

        // Notify parent component
        onInviteSuccess?.()
      } else {
        throw new Error(data.error || "Failed to invite user")
      }
    } catch (error) {
      console.error("Error inviting user:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to invite user"

      setInviteResult({
        success: false,
        message: errorMessage,
      })

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsInviting(false)
    }
  }

  const validateUserId = (userId: string) => {
    // Basic validation for Clerk user IDs
    return userId.startsWith("user_") && userId.length > 10
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invite Player
        </CardTitle>
        <CardDescription>Add a new player to this campaign by entering their user ID</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              type="text"
              placeholder="user_2ABC123DEF456GHI789"
              value={userIdToInvite}
              onChange={(e) => setUserIdToInvite(e.target.value)}
              disabled={isInviting}
              className={userIdToInvite && !validateUserId(userIdToInvite) ? "border-red-500 focus:border-red-500" : ""}
            />
            {userIdToInvite && !validateUserId(userIdToInvite) && (
              <p className="text-sm text-red-500">
                User ID should start with "user_" and be at least 10 characters long
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isInviting}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Player">Player</SelectItem>
                <SelectItem value="DM">Dungeon Master</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isInviting || !userIdToInvite.trim() || !validateUserId(userIdToInvite)}
            className="w-full"
          >
            {isInviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Player
              </>
            )}
          </Button>

          {inviteResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-md ${
                inviteResult.success
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {inviteResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span className="text-sm">{inviteResult.message}</span>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

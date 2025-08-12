"use client"

import { use, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Users, UserPlus } from "lucide-react"

interface CampaignSettingsPageProps {
  params: Promise<{ id: string }>
}

export default function CampaignSettingsPage({ params }: CampaignSettingsPageProps) {
  const { id: campaignId } = use(params)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleInviteSuccess = () => {
    // Trigger refresh of members list
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Campaign Settings
        </h1>
        <p className="text-muted-foreground mt-2">Manage your campaign members and settings</p>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <CampaignMembersList campaignId={campaignId} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="invite" className="space-y-6">
          <InviteUserForm campaignId={campaignId} onInviteSuccess={handleInviteSuccess} />

          <Card>
            <CardHeader>
              <CardTitle>How to find User IDs</CardTitle>
              <CardDescription>To invite players, you'll need their Clerk user ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p>
                  <strong>For testing:</strong> User IDs start with "user_" followed by a random string.
                </p>
                <p>
                  <strong>In production:</strong> Players can find their user ID in their profile settings, or you can
                  ask them to share it with you.
                </p>
                <div className="bg-muted p-3 rounded-md font-mono text-sm">Example: user_2abc123def456ghi789</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

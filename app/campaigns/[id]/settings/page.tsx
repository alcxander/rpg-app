"use client"

import { use } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Users, UserPlus } from "lucide-react"
import { useState } from "react"

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
    <div className="container mx-auto py-8 px-4">
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
              <CardTitle>How to Find User IDs</CardTitle>
              <CardDescription>Help your players find their user ID to join your campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">For Players:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Check your profile page or account settings</li>
                  <li>• Look for a string starting with "user_"</li>
                  <li>• Ask the DM to check the Clerk dashboard</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">For DMs:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Visit your Clerk dashboard</li>
                  <li>• Go to the Users section</li>
                  <li>• Find the player and copy their User ID</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

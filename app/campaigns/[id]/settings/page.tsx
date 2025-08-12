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
              <CardDescription>Instructions for finding user IDs to invite players</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">For Clerk Authentication:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Go to your Clerk Dashboard</li>
                  <li>Navigate to Users section</li>
                  <li>Find the user you want to invite</li>
                  <li>Copy their User ID (starts with "user_")</li>
                </ol>
              </div>

              <div>
                <h4 className="font-medium mb-2">User ID Format:</h4>
                <code className="text-xs bg-muted px-2 py-1 rounded">user_2ABC123DEF456GHI789</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

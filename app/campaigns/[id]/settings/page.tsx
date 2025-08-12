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
              <CardDescription>Help your players find their user ID to join the campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">For Players:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to your profile settings</li>
                  <li>Look for "User ID" or "Account ID"</li>
                  <li>Copy the ID (starts with "user_")</li>
                  <li>Share it with your DM</li>
                </ol>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">For DMs:</h4>
                <p className="text-sm">
                  You can also find user IDs in your Clerk dashboard under "Users" if you have admin access to the
                  application.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

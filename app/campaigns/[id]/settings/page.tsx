"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Settings, Users, UserPlus } from "lucide-react"

interface CampaignSettingsPageProps {
  params: {
    id: string
  }
}

export default function CampaignSettingsPage({ params }: CampaignSettingsPageProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleInviteSuccess = () => {
    // Trigger a refresh of the members list
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
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Players
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <CampaignMembersList campaignId={params.id} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="invite">
          <InviteUserForm campaignId={params.id} onInviteSuccess={handleInviteSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

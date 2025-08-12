"use client"

import { useState, use } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Settings, Users, UserPlus } from "lucide-react"

interface CampaignSettingsPageProps {
  params: Promise<{ id: string }>
}

export default function CampaignSettingsPage({ params }: CampaignSettingsPageProps) {
  const { id: campaignId } = use(params)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleInviteSuccess = () => {
    // Trigger a refresh of the members list
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

      <Tabs defaultValue="members" className="w-full">
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

        <TabsContent value="members" className="mt-6">
          <CampaignMembersList campaignId={campaignId} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="invite" className="mt-6">
          <InviteUserForm campaignId={campaignId} onInviteSuccess={handleInviteSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

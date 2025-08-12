"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Users, UserPlus } from "lucide-react"

export default function CampaignSettingsPage() {
  const params = useParams()
  const campaignId = params.campaignId as string
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleInviteSuccess = () => {
    // Trigger refresh of members list
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Campaign Settings</h1>
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

        <TabsContent value="members" className="space-y-4">
          <CampaignMembersList campaignId={campaignId} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="invite" className="space-y-4">
          <div className="flex justify-center">
            <InviteUserForm campaignId={campaignId} onInviteSuccess={handleInviteSuccess} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

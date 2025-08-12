"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InviteUserForm } from "@/components/campaigns/InviteUserForm"
import { CampaignMembersList } from "@/components/campaigns/CampaignMembersList"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, Users, UserPlus } from "lucide-react"
import Link from "next/link"

interface Campaign {
  id: string
  name: string
  description: string
  owner_id: string
  role: string
  settings: any
}

export default function CampaignSettingsPage() {
  const params = useParams()
  const { user } = useUser()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const response = await fetch("/api/campaigns")
        if (!response.ok) throw new Error("Failed to fetch campaigns")

        const campaigns = await response.json()
        const foundCampaign = campaigns.find((c: Campaign) => c.id === campaignId)

        if (foundCampaign) {
          setCampaign(foundCampaign)
        }
      } catch (error) {
        console.error("Failed to fetch campaign:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (campaignId) {
      fetchCampaign()
    }
  }, [campaignId])

  const handleInviteSuccess = () => {
    // Trigger refresh of members list
    setRefreshTrigger((prev) => prev + 1)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Campaign Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The campaign you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link href="/campaigns">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Campaigns
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isOwner = campaign.owner_id === user?.id || campaign.role === "Owner"

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/campaigns/${campaignId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaign
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
        </div>

        <p className="text-muted-foreground">Manage your campaign settings and members</p>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Players
            </TabsTrigger>
          )}
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <CampaignMembersList campaignId={campaignId} isOwner={isOwner} refreshTrigger={refreshTrigger} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="invite">
            <InviteUserForm campaignId={campaignId} onInviteSuccess={handleInviteSuccess} />
          </TabsContent>
        )}

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic campaign information and configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Campaign Name</label>
                  <p className="text-sm text-muted-foreground">{campaign.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground">{campaign.description || "No description provided"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Your Role</label>
                  <p className="text-sm text-muted-foreground">{campaign.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

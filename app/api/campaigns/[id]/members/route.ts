import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)
  const { id: campaignId } = await params

  try {
    console.log("[api/campaigns/members] GET start", { reqId, campaignId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign (owner or member)
    console.log("[api/campaigns/members] GET verifying access", { reqId, campaignId, userId })

    // Check if user owns the campaign
    const { data: ownedCampaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("created_by", userId)
      .single()

    // Check if user is a member
    let isMember = false
    if (!ownedCampaign) {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      isMember = !!membership
    }

    if (!ownedCampaign && !isMember) {
      console.log("[api/campaigns/members] GET access denied", { reqId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get campaign members with user details
    console.log("[api/campaigns/members] GET fetching members", { reqId })
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
        added_by,
        users (
          id,
          email,
          name,
          image_url
        )
      `)
      .eq("campaign_id", campaignId)

    if (membersError) {
      console.log("[api/campaigns/members] GET members error", { reqId, error: membersError.message })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Get campaign owner details
    console.log("[api/campaigns/members] GET fetching campaign owner", { reqId })
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select(`
        id,
        name,
        created_by,
        created_at,
        users!campaigns_created_by_fkey (
          id,
          email,
          name,
          image_url
        )
      `)
      .eq("id", campaignId)
      .single()

    if (campaignError) {
      console.log("[api/campaigns/members] GET campaign error", { reqId, error: campaignError.message })
      return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 })
    }

    // Combine owner and members
    const allMembers = [
      // Campaign owner
      {
        id: `owner-${campaign.created_by}`,
        user_id: campaign.created_by,
        role: "DM",
        joined_at: campaign.created_at,
        added_by: null,
        users: campaign.users,
      },
      // Regular members
      ...(members || []),
    ]

    // Remove duplicates (in case owner is also in members table)
    const uniqueMembers = allMembers.filter(
      (member, index, arr) => arr.findIndex((m) => m.user_id === member.user_id) === index,
    )

    // Sort by role (DM first) then by join date
    uniqueMembers.sort((a, b) => {
      if (a.role === "DM" && b.role !== "DM") return -1
      if (a.role !== "DM" && b.role === "DM") return 1
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })

    console.log("[api/campaigns/members] GET success", {
      reqId,
      memberCount: uniqueMembers.length,
      campaignName: campaign.name,
    })

    return NextResponse.json({
      members: uniqueMembers,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        created_by: campaign.created_by,
      },
    })
  } catch (error: any) {
    console.error("[api/campaigns/members] GET error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

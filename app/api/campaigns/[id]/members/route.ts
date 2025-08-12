import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const reqId = Math.random().toString(36).substring(7)
  const campaignId = params.id

  try {
    console.log("[api/campaigns/members] GET start", { reqId, campaignId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] Campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user is owner or member
    const isOwner = campaign.owner_id === userId
    let isMember = false

    if (!isOwner) {
      const { data: memberCheck } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      isMember = !!memberCheck
    }

    if (!isOwner && !isMember) {
      console.log("[api/campaigns/members] Access denied", { reqId, userId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get campaign members with user details
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        *,
        users (
          id,
          email,
          name,
          avatar_url
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (membersError) {
      console.log("[api/campaigns/members] Failed to fetch members", { reqId, error: membersError.message })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Add campaign owner as a member if not already in the list
    const ownerInMembers = members?.some((m) => m.user_id === campaign.owner_id)
    let allMembers = members || []

    if (!ownerInMembers) {
      // Get owner details
      const { data: owner } = await supabase
        .from("users")
        .select("id, email, name, avatar_url")
        .eq("id", campaign.owner_id)
        .single()

      if (owner) {
        allMembers = [
          {
            id: "owner",
            campaign_id: campaignId,
            user_id: campaign.owner_id,
            role: "DM",
            joined_at: campaign.created_at,
            added_by: null,
            users: owner,
          },
          ...allMembers,
        ]
      }
    }

    console.log("[api/campaigns/members] GET success", { reqId, memberCount: allMembers.length })

    return NextResponse.json({
      members: allMembers,
    })
  } catch (error) {
    console.error("[api/campaigns/members] GET error", {
      reqId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

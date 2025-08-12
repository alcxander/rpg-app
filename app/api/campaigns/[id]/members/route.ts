import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] GET start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = await params
    const supabase = createAdminClient()

    // Verify user has access to this campaign (owner or member)
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] GET campaign not found", {
        reqId,
        campaignId,
        error: campaignError?.message,
      })
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
      console.log("[api/campaigns/members] GET access denied", { reqId, userId, campaignId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        *,
        users (
          id,
          name,
          clerk_id
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (membersError) {
      console.log("[api/campaigns/members] GET members error", {
        reqId,
        error: membersError.message,
      })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Add owner to the list if not already there
    const ownerAsMember = members?.find((m) => m.user_id === campaign.owner_id)
    let allMembers = members || []

    if (!ownerAsMember && campaign.owner_id) {
      // Get owner user data
      const { data: ownerUser } = await supabase
        .from("users")
        .select("id, name, clerk_id")
        .eq("id", campaign.owner_id)
        .single()

      if (ownerUser) {
        allMembers = [
          {
            id: `owner-${campaign.id}`,
            campaign_id: campaignId,
            user_id: campaign.owner_id,
            role: "Owner",
            joined_at: campaign.created_at,
            added_by: null,
            users: ownerUser,
          },
          ...allMembers,
        ]
      }
    }

    console.log("[api/campaigns/members] GET success", {
      reqId,
      campaignId,
      memberCount: allMembers.length,
    })

    return NextResponse.json(allMembers)
  } catch (error: any) {
    console.error("[api/campaigns/members] GET error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] DELETE start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] DELETE unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = await params
    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get("userId")

    if (!memberUserId) {
      console.log("[api/campaigns/members] DELETE missing userId", { reqId })
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify user is campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("owner_id", userId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] DELETE not owner", {
        reqId,
        campaignId,
        userId,
        error: campaignError?.message,
      })
      return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 404 })
    }

    // Can't remove the owner
    if (memberUserId === campaign.owner_id) {
      console.log("[api/campaigns/members] DELETE cannot remove owner", { reqId, memberUserId })
      return NextResponse.json({ error: "Cannot remove campaign owner" }, { status: 400 })
    }

    // Remove from campaign_members
    const { error: removeError } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", memberUserId)

    if (removeError) {
      console.log("[api/campaigns/members] DELETE remove error", {
        reqId,
        error: removeError.message,
      })
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    console.log("[api/campaigns/members] DELETE success", {
      reqId,
      campaignId,
      memberUserId,
    })

    return NextResponse.json({ message: "Member removed successfully" })
  } catch (error: any) {
    console.error("[api/campaigns/members] DELETE error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

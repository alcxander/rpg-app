import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] GET start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = params

    console.log("[api/campaigns/members] GET processing", { reqId, campaignId, userId })

    const supabase = createAdminClient()

    // Verify the campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] GET campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user has access to view members
    let hasAccess = false

    if (campaign.owner_id === userId) {
      hasAccess = true
    } else {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership) {
        hasAccess = true
      }
    }

    if (!hasAccess) {
      console.log("[api/campaigns/members] GET access denied", { reqId, userId, campaignId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all members of the campaign
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
      console.error("[api/campaigns/members] GET members query error", { reqId, error: membersError })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Also include the campaign owner if they're not in the members table
    const ownerInMembers = members?.some((m) => m.user_id === campaign.owner_id)
    let owner = null

    if (!ownerInMembers) {
      const { data: ownerData } = await supabase
        .from("users")
        .select("id, name, clerk_id")
        .eq("id", campaign.owner_id)
        .single()

      if (ownerData) {
        owner = {
          id: `owner-${campaign.owner_id}`,
          campaign_id: campaignId,
          user_id: campaign.owner_id,
          role: "Owner",
          joined_at: campaign.created_at,
          added_by: null,
          users: ownerData,
        }
      }
    }

    const allMembers = owner ? [owner, ...(members || [])] : members || []

    console.log("[api/campaigns/members] GET success", {
      reqId,
      campaignId,
      memberCount: allMembers.length,
    })

    return NextResponse.json({
      members: allMembers,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        owner_id: campaign.owner_id,
      },
    })
  } catch (error: any) {
    console.error("[api/campaigns/members] GET error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] DELETE start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] DELETE unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = params
    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get("userId")

    if (!memberUserId) {
      console.log("[api/campaigns/members] DELETE missing userId", { reqId })
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    console.log("[api/campaigns/members] DELETE processing", {
      reqId,
      campaignId,
      memberUserId,
      requesterId: userId,
    })

    const supabase = createAdminClient()

    // Verify the campaign exists and user has permission to remove members
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] DELETE campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check permissions: only owner or DMs can remove members
    let canRemove = false

    if (campaign.owner_id === userId) {
      canRemove = true
    } else {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        canRemove = true
      }
    }

    // Users can also remove themselves
    if (memberUserId === userId) {
      canRemove = true
    }

    if (!canRemove) {
      console.log("[api/campaigns/members] DELETE insufficient permissions", {
        reqId,
        userId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json({ error: "Insufficient permissions to remove member" }, { status: 403 })
    }

    // Cannot remove the campaign owner
    if (memberUserId === campaign.owner_id) {
      console.log("[api/campaigns/members] DELETE cannot remove owner", { reqId, memberUserId })
      return NextResponse.json({ error: "Cannot remove campaign owner" }, { status: 400 })
    }

    // Remove the member
    const { error: removeError } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", memberUserId)

    if (removeError) {
      console.error("[api/campaigns/members] DELETE remove error", { reqId, error: removeError })
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    console.log("[api/campaigns/members] DELETE success", {
      reqId,
      campaignId,
      removedUserId: memberUserId,
      removedBy: userId,
    })

    return NextResponse.json({
      success: true,
      message: "Member removed successfully",
    })
  } catch (error: any) {
    console.error("[api/campaigns/members] DELETE error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

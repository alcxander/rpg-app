import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await context.params
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] GET start", { reqId, campaignId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] GET campaign not found", { reqId, campaignId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user has access to view members (owner or member)
    let hasAccess = false
    let accessReason = ""

    if (campaign.owner_id === userId) {
      hasAccess = true
      accessReason = "campaign owner"
    } else {
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership) {
        hasAccess = true
        accessReason = `campaign member (${membership.role})`
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/campaigns/members] GET membership check error", { reqId, error: memberError })
      }
    }

    if (!hasAccess) {
      console.log("[api/campaigns/members] GET access denied", {
        reqId,
        userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Access denied. You must be a member of this campaign to view its members.",
        },
        { status: 403 },
      )
    }

    console.log("[api/campaigns/members] GET access granted", { reqId, accessReason })

    // Get all campaign members
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

    // Add the campaign owner as a special member
    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("id, name, clerk_id")
      .eq("clerk_id", campaign.owner_id)
      .single()

    const allMembers = []

    // Add owner first
    if (owner) {
      allMembers.push({
        id: `owner-${campaign.id}`,
        user_id: campaign.owner_id,
        role: "Owner",
        joined_at: campaign.created_at,
        users: owner,
      })
    }

    // Add regular members
    if (members) {
      allMembers.push(...members)
    }

    console.log("[api/campaigns/members] GET success", {
      reqId,
      campaignId,
      memberCount: allMembers.length,
      accessReason,
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await context.params
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/members] DELETE start", { reqId, campaignId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/campaigns/members] DELETE unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userIdToRemove = searchParams.get("userId")

    if (!userIdToRemove) {
      console.log("[api/campaigns/members] DELETE missing userId", { reqId })
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    console.log("[api/campaigns/members] DELETE processing", { reqId, campaignId, userIdToRemove, requesterId: userId })

    const supabase = createAdminClient()

    // Verify campaign exists and user has permission to remove members
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] DELETE campaign not found", { reqId, campaignId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if requester has permission to remove members (owner or DM)
    let canRemove = false
    let requesterRole = ""

    if (campaign.owner_id === userId) {
      canRemove = true
      requesterRole = "Owner"
    } else {
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        canRemove = true
        requesterRole = "DM"
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/campaigns/members] DELETE membership check error", { reqId, error: memberError })
      }
    }

    if (!canRemove) {
      console.log("[api/campaigns/members] DELETE insufficient permissions", {
        reqId,
        requesterId: userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Only campaign owners and DMs can remove members",
        },
        { status: 403 },
      )
    }

    // Cannot remove the campaign owner
    if (userIdToRemove === campaign.owner_id) {
      console.log("[api/campaigns/members] DELETE cannot remove owner", {
        reqId,
        userIdToRemove,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Cannot remove the campaign owner",
        },
        { status: 400 },
      )
    }

    console.log("[api/campaigns/members] DELETE permission granted", { reqId, requesterRole })

    // Remove the member
    const { data: removedMember, error: removeError } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", userIdToRemove)
      .select(`
        *,
        users (
          id,
          name,
          clerk_id
        )
      `)
      .single()

    if (removeError) {
      console.error("[api/campaigns/members] DELETE remove error", { reqId, error: removeError })
      if (removeError.code === "PGRST116") {
        return NextResponse.json({ error: "Member not found in this campaign" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    console.log("[api/campaigns/members] DELETE success", {
      reqId,
      campaignId,
      userIdToRemove,
      removedMemberName: removedMember?.users?.name,
      requesterId: userId,
      requesterRole,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${removedMember?.users?.name || userIdToRemove} from campaign "${campaign.name}"`,
      removedMember: {
        user_id: userIdToRemove,
        name: removedMember?.users?.name,
        role: removedMember?.role,
      },
    })
  } catch (error: any) {
    console.error("[api/campaigns/members] DELETE error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

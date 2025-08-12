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

    console.log("[api/campaigns/members] GET processing", { reqId, campaignId, userId })

    const supabase = createAdminClient()

    // First verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] GET campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user is owner or member
    let hasAccess = campaign.owner_id === userId

    if (!hasAccess) {
      const { data: memberCheck } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      hasAccess = !!memberCheck
    }

    if (!hasAccess) {
      console.log("[api/campaigns/members] GET access denied", { reqId, userId, campaignId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all members including the owner
    const members = []

    // Add the owner as a member
    if (campaign.owner_id) {
      const { data: ownerUser } = await supabase.from("users").select("*").eq("id", campaign.owner_id).single()

      if (ownerUser) {
        members.push({
          id: `owner-${campaign.owner_id}`,
          user_id: campaign.owner_id,
          role: "Owner",
          joined_at: campaign.created_at,
          users: ownerUser,
        })
      }
    }

    // Get campaign members
    const { data: campaignMembers, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        *,
        users (*)
      `)
      .eq("campaign_id", campaignId)

    if (membersError) {
      console.error("[api/campaigns/members] GET members error", { reqId, error: membersError })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Add campaign members to the list
    if (campaignMembers) {
      members.push(...campaignMembers)
    }

    console.log("[api/campaigns/members] GET success", {
      reqId,
      campaignId,
      memberCount: members.length,
      members: members.map((m) => ({ user_id: m.user_id, role: m.role })),
    })

    return NextResponse.json(members)
  } catch (error: any) {
    console.error("[api/campaigns/members] GET error", { reqId, error: error.message, stack: error.stack })
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
    const userIdToRemove = searchParams.get("userId")

    if (!userIdToRemove) {
      console.log("[api/campaigns/members] DELETE missing userId", { reqId })
      return NextResponse.json({ error: "User ID to remove is required" }, { status: 400 })
    }

    console.log("[api/campaigns/members] DELETE processing", {
      reqId,
      campaignId,
      userIdToRemove,
      removedBy: userId,
    })

    const supabase = createAdminClient()

    // First verify the campaign exists and the remover has permission
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] DELETE campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if remover is the owner or has DM permissions
    if (campaign.owner_id !== userId) {
      const { data: memberCheck } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!memberCheck || memberCheck.role !== "DM") {
        console.log("[api/campaigns/members] DELETE insufficient permissions", {
          reqId,
          userId,
          campaignOwnerId: campaign.owner_id,
        })
        return NextResponse.json({ error: "Only campaign owners and DMs can remove members" }, { status: 403 })
      }
    }

    // Cannot remove the owner
    if (userIdToRemove === campaign.owner_id) {
      console.log("[api/campaigns/members] DELETE cannot remove owner", { reqId, userIdToRemove })
      return NextResponse.json({ error: "Cannot remove the campaign owner" }, { status: 400 })
    }

    // Remove the member
    const { error: removeError } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", userIdToRemove)

    if (removeError) {
      console.error("[api/campaigns/members] DELETE failed to remove member", { reqId, error: removeError })
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    console.log("[api/campaigns/members] DELETE success", { reqId, campaignId, userIdToRemove })

    return NextResponse.json({ success: true, message: "Member removed successfully" })
  } catch (error: any) {
    console.error("[api/campaigns/members] DELETE error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

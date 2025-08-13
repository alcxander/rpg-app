import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/invite] POST start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = params
    const body = await request.json()
    const { userIdToInvite, role = "Player" } = body

    if (!userIdToInvite) {
      console.log("[api/campaigns/invite] POST missing userIdToInvite", { reqId })
      return NextResponse.json({ error: "User ID to invite is required" }, { status: 400 })
    }

    console.log("[api/campaigns/invite] POST processing", {
      reqId,
      campaignId,
      userIdToInvite,
      role,
      invitedBy: userId,
    })

    const supabase = createAdminClient()

    // First, verify the campaign exists and the inviter has permission
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] POST campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if inviter is the owner or has DM permissions
    if (campaign.owner_id !== userId) {
      // Check if user is a DM in this campaign
      const { data: memberCheck } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!memberCheck || memberCheck.role !== "DM") {
        console.log("[api/campaigns/invite] POST insufficient permissions", {
          reqId,
          userId,
          campaignOwnerId: campaign.owner_id,
        })
        return NextResponse.json({ error: "Only campaign owners and DMs can invite players" }, { status: 403 })
      }
    }

    // Verify the user to invite exists in our system
    const { data: userToInvite, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToInvite)
      .single()

    if (userError || !userToInvite) {
      console.log("[api/campaigns/invite] POST user to invite not found", { reqId, userIdToInvite, error: userError })
      return NextResponse.json(
        {
          error: "User not found. Make sure they have signed up and their user ID is correct.",
        },
        { status: 404 },
      )
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userIdToInvite)
      .single()

    if (existingMember) {
      console.log("[api/campaigns/invite] POST user already member", { reqId, userIdToInvite, campaignId })
      return NextResponse.json({ error: "User is already a member of this campaign" }, { status: 400 })
    }

    if (!["Player", "DM"].includes(role)) {
      console.log("[api/campaigns/invite] POST invalid role", { reqId, role })
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Add the user to campaign_members
    const { data: newMember, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: userIdToInvite,
        role: role,
        added_by: userId,
      })
      .select()
      .single()

    if (memberError) {
      console.error("[api/campaigns/invite] POST failed to add member", { reqId, error: memberError })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    // Initialize player's gold for this campaign
    const { error: goldError } = await supabase.from("players_gold").insert({
      player_id: userIdToInvite,
      campaign_id: campaignId,
      gold_amount: 0,
    })

    if (goldError) {
      console.log("[api/campaigns/invite] POST gold init error", {
        reqId,
        error: goldError.message,
      })
      // Don't fail the invite if gold initialization fails
    }

    console.log("[api/campaigns/invite] POST success", {
      reqId,
      memberId: newMember.id,
      campaignId,
      userIdToInvite,
      role,
    })

    return NextResponse.json({
      success: true,
      member: newMember,
      message: `${userToInvite.name} has been invited to the campaign as ${role}`,
    })
  } catch (error: any) {
    console.error("[api/campaigns/invite] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

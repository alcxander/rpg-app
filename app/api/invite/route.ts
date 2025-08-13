import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/invite] POST start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, userIdToInvite, name } = body

    if (!campaignId || !userIdToInvite) {
      console.log("[api/invite] POST missing required fields", { reqId, campaignId, userIdToInvite })
      return NextResponse.json({ error: "Campaign ID and user ID to invite are required" }, { status: 400 })
    }

    console.log("[api/invite] POST processing", { reqId, campaignId, userIdToInvite, inviterUserId: userId })

    const supabase = createAdminClient()

    // Verify the campaign exists and the inviter has permission
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/invite] POST campaign not found", { reqId, campaignId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if the inviter has permission (owner or DM)
    let canInvite = false
    let inviterRole = ""

    if (campaign.owner_id === userId) {
      canInvite = true
      inviterRole = "Owner"
    } else {
      // Check if inviter is a DM in the campaign
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        canInvite = true
        inviterRole = "DM"
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/invite] POST membership check error", { reqId, error: memberError })
      }
    }

    if (!canInvite) {
      console.log("[api/invite] POST insufficient permissions", {
        reqId,
        inviterUserId: userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Only campaign owners and DMs can invite players",
        },
        { status: 403 },
      )
    }

    console.log("[api/invite] POST permission granted", { reqId, inviterRole })

    // Check if the user to invite exists in our system
    const { data: userToInvite, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_id", userIdToInvite)
      .single()

    if (userError || !userToInvite) {
      console.log("[api/invite] POST user to invite not found", { reqId, userIdToInvite, error: userError })
      return NextResponse.json(
        {
          error: "User not found. They may need to sign up first.",
        },
        { status: 404 },
      )
    }

    // Check if user is already a member
    const { data: existingMembership, error: existingError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userIdToInvite)
      .single()

    if (existingMembership) {
      console.log("[api/invite] POST user already a member", {
        reqId,
        userIdToInvite,
        campaignId,
        existingRole: existingMembership.role,
      })
      return NextResponse.json(
        {
          error: `User is already a member of this campaign (${existingMembership.role})`,
        },
        { status: 400 },
      )
    }

    // Add user to campaign_members
    const { data: newMembership, error: membershipError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: userIdToInvite,
        role: "Player", // Default role for invited users
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (membershipError) {
      console.error("[api/invite] POST failed to create membership", { reqId, error: membershipError })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    console.log("[api/invite] POST success", {
      reqId,
      campaignId,
      campaignName: campaign.name,
      userIdToInvite,
      userName: userToInvite.name,
      inviterUserId: userId,
      inviterRole,
      membershipId: newMembership.id,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully invited ${userToInvite.name} to campaign "${campaign.name}"`,
      membership: {
        id: newMembership.id,
        campaign_id: campaignId,
        user_id: userIdToInvite,
        role: newMembership.role,
        joined_at: newMembership.joined_at,
      },
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      invitedUser: {
        id: userToInvite.id,
        name: userToInvite.name,
        clerk_id: userToInvite.clerk_id,
      },
    })
  } catch (error: any) {
    console.error("[api/invite] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

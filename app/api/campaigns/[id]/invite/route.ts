import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns/invite] POST start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: campaignId } = await params
    const body = await request.json()
    const { inviteUserId, role = "Player" } = body

    if (!inviteUserId) {
      console.log("[api/campaigns/invite] POST missing inviteUserId", { reqId })
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    if (!["Player", "DM"].includes(role)) {
      console.log("[api/campaigns/invite] POST invalid role", { reqId, role })
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify the campaign exists and user is the owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("owner_id", userId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] POST campaign not found or not owner", {
        reqId,
        campaignId,
        userId,
        error: campaignError?.message,
      })
      return NextResponse.json({ error: "Campaign not found or access denied" }, { status: 404 })
    }

    // Check if the user exists
    const { data: inviteUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", inviteUserId)
      .single()

    if (userError || !inviteUser) {
      console.log("[api/campaigns/invite] POST user not found", {
        reqId,
        inviteUserId,
        error: userError?.message,
      })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteUserId)
      .single()

    if (existingMember) {
      console.log("[api/campaigns/invite] POST user already member", { reqId, inviteUserId, campaignId })
      return NextResponse.json({ error: "User is already a member of this campaign" }, { status: 400 })
    }

    // Add user to campaign_members
    const { data: newMember, error: addMemberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteUserId,
        role: role,
        added_by: userId,
      })
      .select(`
        *,
        campaigns (name),
        users (name, clerk_id)
      `)
      .single()

    if (addMemberError) {
      console.log("[api/campaigns/invite] POST add member error", {
        reqId,
        error: addMemberError.message,
      })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    // Initialize player's gold for this campaign
    const { error: goldError } = await supabase.from("players_gold").insert({
      player_id: inviteUserId,
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
      campaignId,
      inviteUserId,
      role,
    })

    return NextResponse.json({
      message: "User successfully invited to campaign",
      member: newMember,
    })
  } catch (error: any) {
    console.error("[api/campaigns/invite] POST error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

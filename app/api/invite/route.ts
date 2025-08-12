import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

// GET: list campaigns owned by the user and campaigns where the user participates in any session
export async function GET() {
  const { userId, getToken } = await getAuth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createAdminClient()

  const owned = await supabase.from("campaigns").select("id, name, updated_at").eq("owner_id", userId)
  if (owned.error) return NextResponse.json({ error: owned.error.message }, { status: 500 })

  const sessions = await supabase
    .from("sessions")
    .select("campaign_id")
    .contains("participants", [{ userId } as any]) // PostgREST JSON contains filter

  if (sessions.error) return NextResponse.json({ error: sessions.error.message }, { status: 500 })

  const campaignIds = Array.from(
    new Set([...(owned.data || []).map((c) => c.id), ...(sessions.data || []).map((s) => s.campaign_id)]),
  )
  const campaigns =
    campaignIds.length > 0
      ? await supabase.from("campaigns").select("id, name, updated_at").in("id", campaignIds)
      : { data: [], error: null as any }

  if (campaigns.error) return NextResponse.json({ error: campaigns.error.message }, { status: 500 })

  return NextResponse.json({ campaigns: campaigns.data })
}

// POST: create campaign { name: string } or invite user to campaign
export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/invite] POST start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, userIdToInvite, name } = body

    console.log("[api/invite] POST processing", {
      reqId,
      campaignId,
      userIdToInvite,
      inviterName: name,
      inviterId: userId,
    })

    if (!campaignId && !userIdToInvite) {
      const name = String(body?.name || "").trim()
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ name, owner_id: userId, settings: { members: [] } })
        .select("id, name")
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ campaign: data })
    }

    if (!campaignId || !userIdToInvite) {
      console.log("[api/invite] POST missing required fields", { reqId, campaignId, userIdToInvite })
      return NextResponse.json({ error: "Campaign ID and user ID to invite are required" }, { status: 400 })
    }

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

    // Check if inviter is the owner or has DM permissions
    if (campaign.owner_id !== userId) {
      const { data: memberCheck } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!memberCheck || memberCheck.role !== "DM") {
        console.log("[api/invite] POST insufficient permissions", {
          reqId,
          userId,
          campaignOwnerId: campaign.owner_id,
        })
        return NextResponse.json({ error: "Only campaign owners and DMs can invite players" }, { status: 403 })
      }
    }

    // Verify the user to invite exists
    const { data: userToInvite, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToInvite)
      .single()

    if (userError || !userToInvite) {
      console.log("[api/invite] POST user to invite not found", { reqId, userIdToInvite, error: userError })
      return NextResponse.json(
        {
          error: "User not found. Make sure they have signed up and their user ID is correct.",
        },
        { status: 404 },
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userIdToInvite)
      .single()

    if (existingMember) {
      console.log("[api/invite] POST user already member", { reqId, userIdToInvite, campaignId })
      return NextResponse.json({ error: "User is already a member of this campaign" }, { status: 400 })
    }

    // Add the user to campaign_members
    const { data: newMember, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: userIdToInvite,
        role: "Player", // Default role for legacy invite system
        added_by: userId,
      })
      .select()
      .single()

    if (memberError) {
      console.error("[api/invite] POST failed to add member", { reqId, error: memberError })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    // Initialize player's gold for this campaign
    const { error: goldError } = await supabase.from("players_gold").insert({
      player_id: userIdToInvite,
      campaign_id: campaignId,
      gold_amount: 0,
    })

    if (goldError) {
      console.log("[api/invite] POST gold init error", {
        reqId,
        error: goldError.message,
      })
      // Don't fail the invite if gold initialization fails
    }

    console.log("[api/invite] POST success", {
      reqId,
      memberId: newMember.id,
      campaignId,
      userIdToInvite,
      campaignName: campaign.name,
    })

    return NextResponse.json({
      success: true,
      member: newMember,
      campaign: campaign,
      message: `${userToInvite.name} has been invited to campaign "${campaign.name}"`,
    })
  } catch (error: any) {
    console.error("[api/invite] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

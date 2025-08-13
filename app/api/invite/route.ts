import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

// GET: list campaigns owned by the user and campaigns where the user participates in any session
export async function GET() {
  const { userId, getToken } = await auth()
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

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, inviteUserId, role = "Player" } = body

    if (!campaignId || !inviteUserId) {
      console.log("[api/invite] POST missing required fields", { reqId, campaignId, inviteUserId })
      return NextResponse.json({ error: "Campaign ID and user ID are required" }, { status: 400 })
    }

    console.log("[api/invite] POST processing", { reqId, campaignId, inviteUserId, role, invitedBy: userId })

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

    // Check if inviter has permission (owner or DM)
    let canInvite = false
    let inviterRole = ""

    if (campaign.owner_id === userId) {
      canInvite = true
      inviterRole = "Owner"
    } else {
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
        userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Only campaign owners and DMs can invite users",
        },
        { status: 403 },
      )
    }

    console.log("[api/invite] POST permission granted", { reqId, inviterRole })

    // Check if the user to invite exists
    const { data: inviteUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_id", inviteUserId)
      .single()

    if (userError || !inviteUser) {
      console.log("[api/invite] POST user not found", { reqId, inviteUserId, error: userError })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember, error: existingError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteUser.id)
      .single()

    if (existingMember) {
      console.log("[api/invite] POST user already member", { reqId, inviteUserId, existingRole: existingMember.role })
      return NextResponse.json(
        {
          error: `User is already a member of this campaign with role: ${existingMember.role}`,
        },
        { status: 400 },
      )
    }

    // Cannot invite the campaign owner
    if (inviteUser.id === campaign.owner_id) {
      console.log("[api/invite] POST cannot invite owner", { reqId, inviteUserId })
      return NextResponse.json({ error: "Cannot invite the campaign owner" }, { status: 400 })
    }

    // Add user to campaign_members
    const { data: newMember, error: inviteError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteUser.id,
        role: role,
        added_by: userId,
      })
      .select(`
        *,
        users (
          id,
          name,
          clerk_id
        )
      `)
      .single()

    if (inviteError) {
      console.error("[api/invite] POST invite error", { reqId, error: inviteError })
      return NextResponse.json({ error: "Failed to invite user" }, { status: 500 })
    }

    console.log("[api/invite] POST success", {
      reqId,
      campaignId,
      campaignName: campaign.name,
      inviteUserId,
      inviteUserName: inviteUser.name,
      role,
      invitedBy: userId,
      inviterRole,
    })

    return NextResponse.json({
      success: true,
      member: newMember,
      message: `Successfully invited ${inviteUser.name} to campaign "${campaign.name}" as ${role}`,
    })
  } catch (error: any) {
    console.error("[api/invite] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * POST /api/campaigns/:id/invite
 * Invites a user to join a campaign
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = rid()
  const { id: campaignId } = await params

  try {
    const { userId } = getAuth(req)
    console.log("[api/campaigns/invite] POST start", { reqId, campaignId, hasUser: !!userId })

    if (!userId) {
      console.warn("[api/campaigns/invite] POST unauthorized", { reqId })
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    }

    const { inviteeId } = body

    if (!inviteeId?.trim()) {
      return NextResponse.json({ ok: false, error: "Invitee ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Step 1: Verify campaign exists and user is owner
    console.log("[api/campaigns/invite] Checking campaign ownership", { reqId, campaignId, userId })
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, owner_id, settings")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error("[api/campaigns/invite] Campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.warn("[api/campaigns/invite] Not campaign owner", { reqId, ownerId: campaign.owner_id, userId })
      return NextResponse.json({ ok: false, error: "Only campaign owner can invite players" }, { status: 403 })
    }

    // Step 2: Verify invitee exists
    console.log("[api/campaigns/invite] Checking invitee exists", { reqId, inviteeId })
    const { data: invitee, error: inviteeError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", inviteeId)
      .single()

    if (inviteeError || !invitee) {
      console.error("[api/campaigns/invite] Invitee not found", { reqId, error: inviteeError?.message })
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Step 3: Check if already a member
    console.log("[api/campaigns/invite] Checking existing membership", { reqId })
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.error("[api/campaigns/invite] Error checking membership", { reqId, error: memberCheckError.message })
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 })
    }

    if (existingMember) {
      console.log("[api/campaigns/invite] User already member", { reqId, role: existingMember.role })
      return NextResponse.json({
        ok: true,
        already_member: true,
        member: {
          user_id: inviteeId,
          role: existingMember.role,
        },
      })
    }

    // Step 4: Add user as campaign member
    console.log("[api/campaigns/invite] Adding campaign member", { reqId })
    const { data: newMember, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select("id, user_id, role, joined_at")
      .single()

    if (memberError) {
      console.error("[api/campaigns/invite] Error creating member", { reqId, error: memberError.message })
      return NextResponse.json({ ok: false, error: "Failed to add member" }, { status: 500 })
    }

    // Step 5: Update campaign settings to include new player
    console.log("[api/campaigns/invite] Updating campaign settings", { reqId })
    const currentPlayers = campaign.settings?.players || []
    if (!currentPlayers.includes(inviteeId)) {
      const updatedSettings = {
        ...campaign.settings,
        players: [...currentPlayers, inviteeId],
      }

      const { error: settingsError } = await supabase
        .from("campaigns")
        .update({ settings: updatedSettings })
        .eq("id", campaignId)

      if (settingsError) {
        console.warn("[api/campaigns/invite] Error updating settings", { reqId, error: settingsError.message })
        // Don't fail the invite for this
      }
    }

    // Step 6: Ensure player has gold record
    console.log("[api/campaigns/invite] Creating gold record", { reqId })
    const { error: goldError } = await supabase.from("players_gold").upsert(
      {
        player_id: inviteeId,
        campaign_id: campaignId,
        gold: 100, // Starting gold
      },
      { onConflict: "player_id,campaign_id" },
    )

    if (goldError) {
      console.warn("[api/campaigns/invite] Error creating gold record", { reqId, error: goldError.message })
      // Don't fail the invite for this
    }

    // Step 7: Add to active sessions in this campaign
    console.log("[api/campaigns/invite] Adding to active sessions", { reqId })
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)

    if (!sessionsError && sessions) {
      for (const session of sessions) {
        // Add to session_participants table
        await supabase.from("session_participants").upsert(
          {
            session_id: session.id,
            user_id: inviteeId,
            role: "Player",
          },
          { onConflict: "session_id,user_id" },
        )

        // Update sessions.participants JSONB for legacy compatibility
        const currentParticipants = session.participants || []
        if (!currentParticipants.includes(inviteeId)) {
          await supabase
            .from("sessions")
            .update({
              participants: [...currentParticipants, inviteeId],
            })
            .eq("id", session.id)
        }
      }
    }

    // Step 8: Send realtime event
    try {
      const channel = supabase.channel(`campaign:${campaignId}`)
      await channel.send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            user_id: inviteeId,
            role: "Player",
            name: invitee.name,
            email: invitee.email,
          },
          campaign_id: campaignId,
          added_by: userId,
        },
      })
    } catch (realtimeError) {
      console.warn("[api/campaigns/invite] Realtime event failed", { reqId, error: realtimeError })
      // Don't fail the invite for this
    }

    console.log("[api/campaigns/invite] POST success", { reqId, memberId: newMember.id })
    return NextResponse.json({
      ok: true,
      already_member: false,
      member: {
        user_id: inviteeId,
        role: "Player",
        joined_at: newMember.joined_at,
        name: invitee.name,
        email: invitee.email,
      },
    })
  } catch (e: any) {
    console.error("[api/campaigns/invite] POST exception", { reqId, message: e?.message, stack: e?.stack })
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

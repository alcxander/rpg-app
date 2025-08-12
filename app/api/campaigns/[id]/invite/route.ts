import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseClient"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).substring(7)
}

/**
 * POST /api/campaigns/:id/invite
 * Invites a user to join a campaign
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = rid()
  const { id: campaignId } = await params

  try {
    console.log("[api/campaigns/invite] POST start", { reqId, campaignId })

    const { userId } = await getAuth(request)

    if (!userId) {
      console.log("[api/campaigns/invite] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { inviteeId } = body

    if (!inviteeId) {
      return NextResponse.json({ error: "Invitee ID is required" }, { status: 400 })
    }

    if (inviteeId === userId) {
      return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 })
    }

    const supabase = createClient()

    // Verify the user is the campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, name, owner_id, settings")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error("[api/campaigns/invite] Campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.log("[api/campaigns/invite] Not campaign owner", { reqId, userId, ownerId: campaign.owner_id })
      return NextResponse.json({ error: "Only campaign owners can invite players" }, { status: 403 })
    }

    // Check if user exists in the users table
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.error("[api/campaigns/invite] Invitee not found", { reqId, inviteeId, error: userError })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.error("[api/campaigns/invite] Member check error", { reqId, error: memberCheckError })
      return NextResponse.json({ error: "Failed to check membership" }, { status: 500 })
    }

    if (existingMember) {
      console.log("[api/campaigns/invite] User already member", { reqId, inviteeId, role: existingMember.role })
      return NextResponse.json({
        ok: true,
        already_member: true,
        member: {
          user_id: inviteeId,
          role: existingMember.role,
          user: inviteeUser,
        },
      })
    }

    // Begin transaction-like operations
    console.log("[api/campaigns/invite] Adding member", { reqId, inviteeId })

    // 1. Add to campaign_members
    const { data: newMember, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select()
      .single()

    if (memberError) {
      console.error("[api/campaigns/invite] Failed to add member", { reqId, error: memberError })
      return NextResponse.json({ error: "Failed to add member to campaign" }, { status: 500 })
    }

    // 2. Update campaign settings to include the new player
    const currentSettings = campaign.settings || {}
    const currentPlayers = currentSettings.players || []

    if (!currentPlayers.includes(inviteeId)) {
      const updatedSettings = {
        ...currentSettings,
        players: [...currentPlayers, inviteeId],
      }

      const { error: settingsError } = await supabase
        .from("campaigns")
        .update({ settings: updatedSettings })
        .eq("id", campaignId)

      if (settingsError) {
        console.error("[api/campaigns/invite] Failed to update settings", { reqId, error: settingsError })
        // Don't fail the request, just log the error
      }
    }

    // 3. Create players_gold record
    const { error: goldError } = await supabase.from("players_gold").upsert(
      {
        player_id: inviteeId,
        campaign_id: campaignId,
        gold: 0,
      },
      {
        onConflict: "player_id,campaign_id",
      },
    )

    if (goldError) {
      console.error("[api/campaigns/invite] Failed to create gold record", { reqId, error: goldError })
      // Don't fail the request, just log the error
    }

    // 4. Add to active sessions in this campaign
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)

    if (!sessionsError && sessions) {
      for (const session of sessions) {
        // Add to session_participants table
        const { error: sessionParticipantError } = await supabase.from("session_participants").upsert(
          {
            session_id: session.id,
            user_id: inviteeId,
          },
          {
            onConflict: "session_id,user_id",
          },
        )

        if (sessionParticipantError) {
          console.error("[api/campaigns/invite] Failed to add to session participants", {
            reqId,
            sessionId: session.id,
            error: sessionParticipantError,
          })
        }

        // Update sessions.participants JSONB for legacy compatibility
        const currentParticipants = session.participants || []
        if (!currentParticipants.includes(inviteeId)) {
          const { error: sessionUpdateError } = await supabase
            .from("sessions")
            .update({
              participants: [...currentParticipants, inviteeId],
            })
            .eq("id", session.id)

          if (sessionUpdateError) {
            console.error("[api/campaigns/invite] Failed to update session participants", {
              reqId,
              sessionId: session.id,
              error: sessionUpdateError,
            })
          }
        }
      }
    }

    console.log("[api/campaigns/invite] POST success", {
      reqId,
      campaignId,
      inviteeId,
      memberId: newMember.id,
    })

    return NextResponse.json({
      ok: true,
      already_member: false,
      member: {
        id: newMember.id,
        user_id: inviteeId,
        role: "Player",
        joined_at: newMember.joined_at,
        user: inviteeUser,
      },
    })
  } catch (error: any) {
    console.error("[api/campaigns/invite] POST error", {
      reqId,
      campaignId,
      error: error.message || error.toString(),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

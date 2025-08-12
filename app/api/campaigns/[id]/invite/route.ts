import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { id: campaignId } = await params
    const { userId } = await getAuth(request)

    console.log("[api/campaigns/invite] POST start", { reqId, campaignId, inviterId: userId })

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { inviteeId } = body

    if (!inviteeId) {
      return NextResponse.json({ error: "inviteeId is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify campaign exists and user is owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("owner_id", userId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] Campaign not found or not owner", { reqId, error: campaignError?.message })
      return NextResponse.json({ error: "Campaign not found or you are not the owner" }, { status: 403 })
    }

    // Verify invitee user exists
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.log("[api/campaigns/invite] Invitee user not found", { reqId, inviteeId, error: userError?.message })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (existingMember) {
      console.log("[api/campaigns/invite] User already member", { reqId, inviteeId })
      return NextResponse.json({
        ok: true,
        already_member: true,
        message: "User is already a member of this campaign",
      })
    }

    // Begin transaction-like operations
    console.log("[api/campaigns/invite] Starting invite operations", { reqId })

    // 1. Insert into campaign_members
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
      console.log("[api/campaigns/invite] Failed to create member", { reqId, error: memberError.message })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    // 2. Update campaign settings to include new player
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
        console.log("[api/campaigns/invite] Failed to update campaign settings", {
          reqId,
          error: settingsError.message,
        })
        // Don't fail the whole operation for this
      }
    }

    // 3. Ensure players_gold record exists
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
      console.log("[api/campaigns/invite] Failed to create gold record", { reqId, error: goldError.message })
      // Don't fail the whole operation for this
    }

    // 4. Add to active sessions in this campaign
    const { data: activeSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)

    if (activeSessions && !sessionsError) {
      for (const session of activeSessions) {
        // Add to session_participants table
        await supabase.from("session_participants").upsert(
          {
            session_id: session.id,
            user_id: inviteeId,
          },
          {
            onConflict: "session_id,user_id",
          },
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

    // 5. Emit realtime event
    try {
      await supabase.channel(`campaign:${campaignId}`).send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            ...newMember,
            user: inviteeUser,
          },
        },
      })
    } catch (realtimeError) {
      console.log("[api/campaigns/invite] Realtime event failed", { reqId, error: realtimeError })
      // Don't fail the operation for realtime issues
    }

    console.log("[api/campaigns/invite] POST success", { reqId, newMemberId: newMember.id })

    return NextResponse.json({
      ok: true,
      member: {
        ...newMember,
        user: inviteeUser,
      },
      already_member: false,
    })
  } catch (error) {
    console.log("[api/campaigns/invite] POST error", {
      reqId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

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

    const supabase = createAdminClient()

    // 1. Verify caller is campaign owner or DM
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id, name, settings")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] POST campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.log("[api/campaigns/invite] POST not owner", { reqId, userId, ownerId: campaign.owner_id })
      return NextResponse.json({ error: "Only campaign owner can invite players" }, { status: 403 })
    }

    // 2. Verify invitee exists
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.log("[api/campaigns/invite] POST user not found", { reqId, inviteeId, error: userError?.message })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // 3. Check if already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.log("[api/campaigns/invite] POST member check error", { reqId, error: memberCheckError.message })
      throw memberCheckError
    }

    if (existingMember) {
      console.log("[api/campaigns/invite] POST already member", { reqId, inviteeId, role: existingMember.role })
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

    // 4. Begin transaction-like operations
    console.log("[api/campaigns/invite] POST starting invite process", { reqId, inviteeId })

    // Insert into campaign_members
    const { data: newMember, error: insertMemberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select()
      .single()

    if (insertMemberError) {
      console.log("[api/campaigns/invite] POST member insert error", { reqId, error: insertMemberError.message })
      throw insertMemberError
    }

    // Update campaign settings to include player
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
        console.log("[api/campaigns/invite] POST settings update error", { reqId, error: settingsError.message })
        // Don't throw - member record is more important
      }
    }

    // Ensure players_gold record exists
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
      console.log("[api/campaigns/invite] POST gold upsert error", { reqId, error: goldError.message })
      // Don't throw - not critical
    }

    // Add to active sessions in this campaign
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)
      .eq("active", true)

    if (!sessionsError && sessions) {
      for (const session of sessions) {
        // Add to session_participants
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
          console.log("[api/campaigns/invite] POST session participant error", {
            reqId,
            sessionId: session.id,
            error: sessionParticipantError.message,
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
            console.log("[api/campaigns/invite] POST session update error", {
              reqId,
              sessionId: session.id,
              error: sessionUpdateError.message,
            })
          }
        }
      }
    }

    console.log("[api/campaigns/invite] POST success", {
      reqId,
      campaignId,
      inviteeId,
      memberRole: newMember.role,
    })

    // Return success response
    return NextResponse.json({
      ok: true,
      already_member: false,
      member: {
        ...newMember,
        user: inviteeUser,
      },
    })
  } catch (error: any) {
    console.log("[api/campaigns/invite] POST error", {
      reqId,
      campaignId,
      error: error.message || error.toString(),
    })
    return NextResponse.json({ error: "Failed to invite user to campaign" }, { status: 500 })
  }
}

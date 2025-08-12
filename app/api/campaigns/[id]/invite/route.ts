import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const reqId = Math.random().toString(36).substring(7)
  const campaignId = params.id

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
      console.log("[api/campaigns/invite] POST missing inviteeId", { reqId })
      return NextResponse.json({ error: "Invitee ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify caller owns the campaign
    console.log("[api/campaigns/invite] POST verifying campaign ownership", { reqId, campaignId, userId })
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, created_by, name, settings")
      .eq("id", campaignId)
      .eq("created_by", userId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] POST campaign not found or not owner", {
        reqId,
        error: campaignError?.message,
      })
      return NextResponse.json({ error: "Campaign not found or you are not the owner" }, { status: 403 })
    }

    // Verify invitee exists
    console.log("[api/campaigns/invite] POST verifying invitee exists", { reqId, inviteeId })
    const { data: invitee, error: inviteeError } = await supabase
      .from("users")
      .select("id, email, name")
      .eq("id", inviteeId)
      .single()

    if (inviteeError || !invitee) {
      console.log("[api/campaigns/invite] POST invitee not found", { reqId, error: inviteeError?.message })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if already a member
    console.log("[api/campaigns/invite] POST checking existing membership", { reqId, campaignId, inviteeId })
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (existingMember) {
      console.log("[api/campaigns/invite] POST already member", { reqId, role: existingMember.role })
      return NextResponse.json({
        ok: true,
        already_member: true,
        member: { user_id: inviteeId, role: existingMember.role },
      })
    }

    // Begin transaction-like operations
    console.log("[api/campaigns/invite] POST creating membership", { reqId })

    // 1. Create campaign membership
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
      console.log("[api/campaigns/invite] POST member creation error", { reqId, error: memberError.message })
      return NextResponse.json({ error: "Failed to create membership" }, { status: 500 })
    }

    // 2. Update campaign settings to include player
    const currentPlayers = campaign.settings?.players || []
    if (!currentPlayers.includes(inviteeId)) {
      const updatedSettings = {
        ...campaign.settings,
        players: [...currentPlayers, inviteeId],
      }

      console.log("[api/campaigns/invite] POST updating campaign settings", { reqId })
      const { error: settingsError } = await supabase
        .from("campaigns")
        .update({ settings: updatedSettings })
        .eq("id", campaignId)

      if (settingsError) {
        console.log("[api/campaigns/invite] POST settings update error", { reqId, error: settingsError.message })
        // Don't fail the invite if settings update fails
      }
    }

    // 3. Create players_gold record
    console.log("[api/campaigns/invite] POST creating gold record", { reqId })
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
      console.log("[api/campaigns/invite] POST gold creation error", { reqId, error: goldError.message })
      // Don't fail the invite if gold creation fails
    }

    // 4. Add to active sessions in this campaign
    console.log("[api/campaigns/invite] POST adding to active sessions", { reqId })
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
            role: "Player",
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

        // Update legacy participants JSONB
        const currentParticipants = session.participants || []
        if (!currentParticipants.includes(inviteeId)) {
          const { error: legacyError } = await supabase
            .from("sessions")
            .update({
              participants: [...currentParticipants, inviteeId],
            })
            .eq("id", session.id)

          if (legacyError) {
            console.log("[api/campaigns/invite] POST legacy participants error", {
              reqId,
              sessionId: session.id,
              error: legacyError.message,
            })
          }
        }
      }
    }

    // 5. Broadcast realtime event
    try {
      console.log("[api/campaigns/invite] POST broadcasting realtime event", { reqId })
      await supabase.channel(`campaign:${campaignId}`).send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            user_id: inviteeId,
            role: "Player",
            user_name: invitee.name || invitee.email,
            joined_at: newMember.joined_at,
          },
        },
      })
    } catch (realtimeError: any) {
      console.log("[api/campaigns/invite] POST realtime error", { reqId, error: realtimeError.message })
      // Don't fail the invite if realtime fails
    }

    console.log("[api/campaigns/invite] POST success", { reqId, memberId: newMember.id })
    return NextResponse.json({
      ok: true,
      already_member: false,
      member: {
        user_id: inviteeId,
        role: "Player",
        user_name: invitee.name || invitee.email,
        joined_at: newMember.joined_at,
      },
    })
  } catch (error: any) {
    console.error("[api/campaigns/invite] POST error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

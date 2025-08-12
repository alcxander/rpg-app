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
    const { userId, sessionId } = getAuth(req)
    console.log("[api/campaigns/invite] POST start", { reqId, hasUser: !!userId, sessionId, campaignId })

    if (!userId) {
      console.warn("[api/campaigns/invite] POST unauthorized", { reqId })
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    let inviteeId = ""
    try {
      const body = await req.json()
      inviteeId = String(body?.inviteeId || "").trim()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    }

    if (!inviteeId) {
      return NextResponse.json({ ok: false, error: "inviteeId required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Step 1: Verify caller is campaign owner or DM
    console.log("[api/campaigns/invite] Checking campaign ownership", { reqId, campaignId, userId })
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id, name, settings")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error("[api/campaigns/invite] Campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 })
    }

    console.log("[api/campaigns/invite] Campaign found", {
      reqId,
      campaign: { id: campaignId, name: campaign.name, owner: campaign.owner_id },
    })

    if (campaign.owner_id !== userId) {
      console.warn("[api/campaigns/invite] Not campaign owner", { reqId, userId, ownerId: campaign.owner_id })
      return NextResponse.json({ ok: false, error: "Only campaign owner can invite players" }, { status: 403 })
    }

    // Step 2: Verify invitee exists
    console.log("[api/campaigns/invite] Looking up invitee", { reqId, inviteeId })
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email, clerk_id")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.error("[api/campaigns/invite] Invitee not found", { reqId, inviteeId, error: userError?.message })
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    console.log("[api/campaigns/invite] Invitee found", {
      reqId,
      invitee: { id: inviteeUser.id, name: inviteeUser.name },
    })

    // Step 3: Check if already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.error("[api/campaigns/invite] Error checking existing membership", {
        reqId,
        error: memberCheckError.message,
      })
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 })
    }

    if (existingMember) {
      console.log("[api/campaigns/invite] User already member", {
        reqId,
        inviteeId,
        campaignId,
        role: existingMember.role,
      })
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

    // Step 4: Begin transaction-like operations
    console.log("[api/campaigns/invite] Adding member to campaign", { reqId })

    // Insert into campaign_members
    const { data: newMember, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select("*")
      .single()

    if (memberError) {
      console.error("[api/campaigns/invite] Failed to add member", {
        reqId,
        error: memberError.message,
        code: memberError.code,
      })
      return NextResponse.json({ ok: false, error: "Failed to add member to campaign" }, { status: 500 })
    }

    console.log("[api/campaigns/invite] Member added successfully", { reqId, memberId: newMember.id })

    // Step 5: Ensure players_gold row exists
    console.log("[api/campaigns/invite] Creating gold record", { reqId })
    const { error: goldError } = await supabase.from("players_gold").upsert(
      {
        player_id: inviteeId,
        campaign_id: campaignId,
        gold: 100, // Starting gold
      },
      {
        onConflict: "player_id,campaign_id",
      },
    )

    if (goldError) {
      console.warn("[api/campaigns/invite] Gold record creation failed", { reqId, error: goldError.message })
      // Don't fail the invite for this
    } else {
      console.log("[api/campaigns/invite] Gold record created", { reqId })
    }

    // Step 6: Add to all active sessions in this campaign
    console.log("[api/campaigns/invite] Adding to campaign sessions", { reqId })
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)

    if (sessionsError) {
      console.warn("[api/campaigns/invite] Failed to fetch sessions", { reqId, error: sessionsError.message })
    } else if (sessions) {
      console.log("[api/campaigns/invite] Found sessions", { reqId, sessionCount: sessions.length })

      for (const session of sessions) {
        // Add to session_participants table
        const { error: participantError } = await supabase.from("session_participants").upsert(
          {
            session_id: session.id,
            user_id: inviteeId,
            role: "Player",
          },
          {
            onConflict: "session_id,user_id",
          },
        )

        if (participantError) {
          console.warn("[api/campaigns/invite] Failed to add session participant", {
            reqId,
            sessionId: session.id,
            error: participantError.message,
          })
        }

        // Update sessions.participants JSONB for legacy compatibility
        const currentParticipants = Array.isArray(session.participants) ? session.participants : []
        if (!currentParticipants.includes(inviteeId)) {
          const { error: updateError } = await supabase
            .from("sessions")
            .update({
              participants: [...currentParticipants, inviteeId],
            })
            .eq("id", session.id)

          if (updateError) {
            console.warn("[api/campaigns/invite] Failed to update session participants", {
              reqId,
              sessionId: session.id,
              error: updateError.message,
            })
          }
        }
      }
    }

    // Step 7: Update campaign settings to include the new player
    console.log("[api/campaigns/invite] Updating campaign settings", { reqId })
    const currentSettings = campaign.settings || {}
    const currentPlayers = currentSettings.players || []

    if (!currentPlayers.includes(inviteeId)) {
      const updatedSettings = {
        ...currentSettings,
        players: [...currentPlayers, inviteeId],
        lastUpdated: new Date().toISOString(),
      }

      const { error: settingsError } = await supabase
        .from("campaigns")
        .update({ settings: updatedSettings })
        .eq("id", campaignId)

      if (settingsError) {
        console.warn("[api/campaigns/invite] Failed to update campaign settings", {
          reqId,
          error: settingsError.message,
        })
      } else {
        console.log("[api/campaigns/invite] Campaign settings updated", { reqId })
      }
    }

    // Step 8: Emit realtime event
    try {
      const channel = supabase.channel(`campaign:${campaignId}`)
      await channel.send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            user_id: inviteeId,
            role: "Player",
            user: inviteeUser,
          },
          added_by: userId,
          campaign_id: campaignId,
        },
      })
      console.log("[api/campaigns/invite] Realtime event sent", { reqId })
    } catch (realtimeError) {
      console.warn("[api/campaigns/invite] Realtime broadcast failed", { reqId, error: realtimeError })
      // Don't fail the request for realtime issues
    }

    console.log("[api/campaigns/invite] POST success", { reqId, inviteeId, campaignId })
    return NextResponse.json({
      ok: true,
      member: {
        user_id: inviteeId,
        role: "Player",
        user: inviteeUser,
      },
      already_member: false,
    })
  } catch (e: any) {
    console.error("[api/campaigns/invite] POST exception", { reqId, message: e?.message, stack: e?.stack })
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let inviteeId = ""
    try {
      const body = await req.json()
      inviteeId = String(body?.inviteeId || "").trim()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!inviteeId) {
      return NextResponse.json({ error: "inviteeId required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify caller is campaign owner or DM
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error("[api/campaigns/invite] Campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.warn("[api/campaigns/invite] Not campaign owner", { reqId, userId, ownerId: campaign.owner_id })
      return NextResponse.json({ error: "Only campaign owner can invite players" }, { status: 403 })
    }

    // Verify invitee exists
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.error("[api/campaigns/invite] Invitee not found", { reqId, inviteeId, error: userError?.message })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Insert into campaign_members with conflict handling
    const { data: member, error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select("*")
      .single()

    let alreadyMember = false
    if (memberError) {
      if (memberError.code === "23505") {
        // unique constraint violation
        alreadyMember = true
        console.log("[api/campaigns/invite] User already member", { reqId, inviteeId, campaignId })
      } else {
        console.error("[api/campaigns/invite] Member insert error", { reqId, error: memberError.message })
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
      }
    }

    // Ensure players_gold row exists
    if (!alreadyMember) {
      await supabase.from("players_gold").upsert(
        {
          player_id: inviteeId,
          campaign_id: campaignId,
          gold: 0,
        },
        {
          onConflict: "player_id,campaign_id",
        },
      )
    }

    // Get active sessions for this campaign and add participant
    const { data: sessions } = await supabase.from("sessions").select("id, participants").eq("campaign_id", campaignId)

    if (sessions && !alreadyMember) {
      for (const session of sessions) {
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

    // Emit realtime event
    try {
      await supabase.channel(`campaign:${campaignId}`).send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            user_id: inviteeId,
            role: "Player",
            user: inviteeUser,
          },
          added_by: userId,
        },
      })
    } catch (realtimeError) {
      console.warn("[api/campaigns/invite] Realtime broadcast failed", { reqId, error: realtimeError })
      // Don't fail the request for realtime issues
    }

    console.log("[api/campaigns/invite] POST done", { reqId, inviteeId, alreadyMember })
    return NextResponse.json({
      ok: true,
      member: alreadyMember
        ? null
        : {
            user_id: inviteeId,
            role: "Player",
            user: inviteeUser,
          },
      already_member: alreadyMember,
    })
  } catch (e: any) {
    console.error("[api/campaigns/invite] POST exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

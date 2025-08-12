import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { id: campaignId } = await params
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
      return NextResponse.json({ error: "Missing inviteeId" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Verify caller owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("owner_id", userId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] POST campaign not found or not owner", {
        reqId,
        error: campaignError?.message,
      })
      return NextResponse.json({ error: "Campaign not found or you are not the owner" }, { status: 403 })
    }

    // 2. Check if already a member
    let alreadyMember = false
    try {
      const { data: existingMember, error: memberError } = await supabase
        .from("campaign_members")
        .select("id, role")
        .eq("campaign_id", campaignId)
        .eq("user_id", inviteeId)
        .single()

      if (existingMember) {
        alreadyMember = true
        console.log("[api/campaigns/invite] POST already member", { reqId, inviteeId, role: existingMember.role })
        return NextResponse.json({
          success: true,
          already_member: true,
          message: "User is already a member of this campaign",
        })
      }
    } catch (error) {
      // Table might not exist yet or no existing member
      console.log("[api/campaigns/invite] POST campaign_members check failed", {
        reqId,
        error: (error as Error).message,
      })
    }

    // 3. Add to campaign_members
    try {
      const { data: newMember, error: memberInsertError } = await supabase
        .from("campaign_members")
        .insert({
          campaign_id: campaignId,
          user_id: inviteeId,
          role: "Player",
          added_by: userId,
        })
        .select()
        .single()

      if (memberInsertError) {
        console.log("[api/campaigns/invite] POST member insert error", { reqId, error: memberInsertError.message })
        return NextResponse.json({ error: "Failed to add member to campaign" }, { status: 500 })
      }

      console.log("[api/campaigns/invite] POST member added", { reqId, member: newMember })
    } catch (error) {
      console.log("[api/campaigns/invite] POST member insert failed", { reqId, error: (error as Error).message })
      return NextResponse.json({ error: "Failed to add member to campaign" }, { status: 500 })
    }

    // 4. Ensure players_gold record exists
    try {
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
      } else {
        console.log("[api/campaigns/invite] POST gold record created", { reqId, inviteeId, campaignId })
      }
    } catch (error) {
      console.log("[api/campaigns/invite] POST gold upsert failed", { reqId, error: (error as Error).message })
    }

    // 5. Add to active sessions in this campaign
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from("sessions")
        .select("id, participants")
        .eq("campaign_id", campaignId)

      if (sessions && !sessionsError) {
        console.log("[api/campaigns/invite] POST adding to sessions", { reqId, sessionCount: sessions.length })

        for (const session of sessions) {
          // Add to session_participants table
          try {
            await supabase.from("session_participants").upsert(
              {
                session_id: session.id,
                user_id: inviteeId,
                role: "Player",
              },
              {
                onConflict: "session_id,user_id",
              },
            )
            console.log("[api/campaigns/invite] POST added to session_participants", {
              reqId,
              sessionId: session.id,
              inviteeId,
            })
          } catch (error) {
            console.log("[api/campaigns/invite] POST session_participants upsert failed", {
              reqId,
              sessionId: session.id,
              error: (error as Error).message,
            })
          }

          // Update sessions.participants JSONB for legacy compatibility
          try {
            const currentParticipants = session.participants || []
            if (!currentParticipants.includes(inviteeId)) {
              const updatedParticipants = [...currentParticipants, inviteeId]
              await supabase.from("sessions").update({ participants: updatedParticipants }).eq("id", session.id)
              console.log("[api/campaigns/invite] POST updated session participants", {
                reqId,
                sessionId: session.id,
                participantCount: updatedParticipants.length,
              })
            }
          } catch (error) {
            console.log("[api/campaigns/invite] POST sessions participants update failed", {
              reqId,
              sessionId: session.id,
              error: (error as Error).message,
            })
          }
        }
      }
    } catch (error) {
      console.log("[api/campaigns/invite] POST sessions update failed", { reqId, error: (error as Error).message })
    }

    // 6. Update campaign.settings.players for legacy compatibility
    try {
      const currentSettings = campaign.settings || {}
      const currentPlayers = currentSettings.players || []

      if (!currentPlayers.includes(inviteeId)) {
        const updatedSettings = {
          ...currentSettings,
          players: [...currentPlayers, inviteeId],
        }

        await supabase.from("campaigns").update({ settings: updatedSettings }).eq("id", campaignId)
        console.log("[api/campaigns/invite] POST updated campaign settings", {
          reqId,
          playerCount: updatedSettings.players.length,
        })
      }
    } catch (error) {
      console.log("[api/campaigns/invite] POST campaign settings update failed", {
        reqId,
        error: (error as Error).message,
      })
    }

    console.log("[api/campaigns/invite] POST success", { reqId, inviteeId, campaignId })

    return NextResponse.json({
      success: true,
      member: {
        user_id: inviteeId,
        role: "Player",
        campaign_id: campaignId,
      },
      already_member: false,
      message: "Player successfully added to campaign",
    })
  } catch (error) {
    console.error("[api/campaigns/invite] POST error", { reqId, error: (error as Error).message })
    return NextResponse.json({ error: "Failed to invite player" }, { status: 500 })
  }
}

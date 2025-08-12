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
      return NextResponse.json({ error: "Invitee ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify the caller is the campaign owner or has DM role
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id, name, settings")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/invite] Campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.log("[api/campaigns/invite] Not campaign owner", { reqId, userId, ownerId: campaign.owner_id })
      return NextResponse.json({ error: "Only campaign owners can invite players" }, { status: 403 })
    }

    // Check if user exists
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      console.log("[api/campaigns/invite] User not found", { reqId, inviteeId, error: userError })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from("campaign_members")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", inviteeId)
      .single()

    if (memberCheckError && !memberCheckError.message.includes("No rows")) {
      console.log("[api/campaigns/invite] Member check error", { reqId, error: memberCheckError })
      return NextResponse.json({ error: "Failed to check membership" }, { status: 500 })
    }

    if (existingMember) {
      console.log("[api/campaigns/invite] User already member", { reqId, inviteeId })
      return NextResponse.json({
        success: true,
        already_member: true,
        message: "User is already a member of this campaign",
      })
    }

    // Add user to campaign_members
    const { data: newMember, error: insertError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: campaignId,
        user_id: inviteeId,
        role: "Player",
        added_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      console.log("[api/campaigns/invite] Failed to add member", { reqId, error: insertError })
      return NextResponse.json({ error: "Failed to add user to campaign" }, { status: 500 })
    }

    // Update campaign settings to include the new player
    const updatedPlayers = [...(campaign.settings?.players || []), inviteeId]
    const { error: settingsError } = await supabase
      .from("campaigns")
      .update({
        settings: {
          ...campaign.settings,
          players: updatedPlayers,
        },
      })
      .eq("id", campaignId)

    if (settingsError) {
      console.log("[api/campaigns/invite] Failed to update settings", { reqId, error: settingsError })
      // Don't fail the request for this
    }

    // Create players_gold record
    const { error: goldError } = await supabase.from("players_gold").upsert({
      player_id: inviteeId,
      campaign_id: campaignId,
      gold: 0,
    })

    if (goldError) {
      console.log("[api/campaigns/invite] Failed to create gold record", { reqId, error: goldError })
      // Don't fail the request for this
    }

    // Add to all active sessions in this campaign
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)

    if (!sessionsError && sessions) {
      for (const session of sessions) {
        // Add to session_participants
        await supabase.from("session_participants").upsert({
          session_id: session.id,
          user_id: inviteeId,
        })

        // Update sessions.participants JSONB for legacy compatibility
        const updatedParticipants = [...(session.participants || []), inviteeId]
        await supabase.from("sessions").update({ participants: updatedParticipants }).eq("id", session.id)
      }
    }

    // Broadcast realtime event
    try {
      const channel = supabase.channel(`campaign:${campaignId}`)
      await channel.send({
        type: "broadcast",
        event: "CAMPAIGN_MEMBER_ADDED",
        payload: {
          member: {
            id: newMember.id,
            user_id: inviteeId,
            role: "Player",
            joined_at: newMember.joined_at,
            user: inviteeUser,
          },
        },
      })
    } catch (realtimeError) {
      console.log("[api/campaigns/invite] Realtime broadcast failed", { reqId, error: realtimeError })
      // Continue - this is not critical
    }

    console.log("[api/campaigns/invite] POST success", { reqId, memberId: newMember.id })

    return NextResponse.json({
      success: true,
      already_member: false,
      member: {
        id: newMember.id,
        user_id: inviteeId,
        role: "Player",
        joined_at: newMember.joined_at,
        user: inviteeUser,
      },
      message: `${inviteeUser.name || inviteeUser.email} has been added to the campaign`,
    })
  } catch (error) {
    console.error("[api/campaigns/invite] POST error", {
      reqId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

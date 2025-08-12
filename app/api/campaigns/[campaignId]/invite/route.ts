import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabaseAdmin"

export async function POST(request: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { campaignId } = params
    const { inviteeId } = await request.json()

    if (!inviteeId) {
      return NextResponse.json({ ok: false, error: "Invitee ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Verify caller is campaign owner or DM
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 })
    }

    // Check if caller is owner or has DM role in campaign
    const isDmOrOwner = campaign.owner_id === userId
    if (!isDmOrOwner) {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!membership || membership.role !== "DM") {
        return NextResponse.json(
          { ok: false, error: "Only campaign owners and DMs can invite players" },
          { status: 403 },
        )
      }
    }

    // Verify invitee exists
    const { data: inviteeUser, error: userError } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", inviteeId)
      .single()

    if (userError || !inviteeUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })
    }

    // Begin transaction-like operations
    let alreadyMember = false

    // Insert into campaign_members with conflict handling
    const { data: memberData, error: memberError } = await supabase
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
      if (memberError.code === "23505") {
        // unique constraint violation
        alreadyMember = true
        // Get existing member data
        const { data: existingMember } = await supabase
          .from("campaign_members")
          .select("*")
          .eq("campaign_id", campaignId)
          .eq("user_id", inviteeId)
          .single()

        if (existingMember) {
          return NextResponse.json({
            ok: true,
            member: existingMember,
            already_member: true,
          })
        }
      }
      throw memberError
    }

    // Ensure players_gold row exists
    await supabase.from("players_gold").upsert(
      {
        player_id: inviteeId,
        campaign_id: campaignId,
        gold_amount: 0,
      },
      {
        onConflict: "player_id,campaign_id",
      },
    )

    // Add to active sessions in this campaign
    const { data: activeSessions } = await supabase
      .from("sessions")
      .select("id, participants")
      .eq("campaign_id", campaignId)
      .eq("active", true)

    if (activeSessions) {
      for (const session of activeSessions) {
        // Insert into session_participants
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

        // Update sessions.participants JSONB for legacy compatibility
        const currentParticipants = session.participants || []
        const participantExists = currentParticipants.some((p: any) => p.userId === inviteeId)

        if (!participantExists) {
          const updatedParticipants = [...currentParticipants, { userId: inviteeId, role: "Player" }]

          await supabase.from("sessions").update({ participants: updatedParticipants }).eq("id", session.id)
        }
      }
    }

    // Emit realtime event
    const campaignChannel = supabase.channel(`campaign:${campaignId}`)
    await campaignChannel.send({
      type: "broadcast",
      event: "CAMPAIGN_MEMBER_ADDED",
      payload: {
        member: {
          user_id: inviteeId,
          role: "Player",
          name: inviteeUser.name,
        },
      },
    })

    return NextResponse.json({
      ok: true,
      member: memberData,
      already_member: alreadyMember,
    })
  } catch (error) {
    console.error("Invite error:", error)
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 })
  }
}

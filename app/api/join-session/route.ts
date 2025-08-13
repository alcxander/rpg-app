import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/join-session] POST start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/join-session] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      console.log("[api/join-session] POST missing sessionId", { reqId })
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    console.log("[api/join-session] POST processing", { reqId, sessionId, userId })

    const supabase = createAdminClient()

    // Get the session and its campaign with detailed logging
    console.log("[api/join-session] POST querying session", { reqId, sessionId })
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        *,
        campaigns (*)
      `)
      .eq("id", sessionId)
      .single()

    console.log("[api/join-session] POST session query result", {
      reqId,
      sessionId,
      found: !!session,
      error: sessionError,
      sessionData: session
        ? {
            id: session.id,
            campaign_id: session.campaign_id,
            active: session.active,
            participants: session.participants,
          }
        : null,
      campaignData: session?.campaigns
        ? {
            id: session.campaigns.id,
            name: session.campaigns.name,
            owner_id: session.campaigns.owner_id,
          }
        : null,
    })

    if (sessionError || !session) {
      console.log("[api/join-session] POST session not found", { reqId, sessionId, error: sessionError })
      return NextResponse.json(
        {
          error: `Session "${sessionId}" not found or not accessible.`,
        },
        { status: 404 },
      )
    }

    console.log("[api/join-session] POST session found", {
      reqId,
      sessionId,
      campaignId: session.campaign_id,
      campaignName: session.campaigns?.name,
      campaignOwnerId: session.campaigns?.owner_id,
      currentUserId: userId,
      isOwner: session.campaigns?.owner_id === userId,
    })

    // Check if user has access to this campaign with detailed logging
    let hasAccess = false
    let accessReason = ""

    // Check if user is the campaign owner
    if (session.campaigns?.owner_id === userId) {
      hasAccess = true
      accessReason = "campaign owner"
      console.log("[api/join-session] POST access granted as owner", {
        reqId,
        userId,
        campaignOwnerId: session.campaigns.owner_id,
      })
    } else {
      // Check if user is a member of the campaign
      console.log("[api/join-session] POST checking campaign membership", {
        reqId,
        userId,
        campaignId: session.campaign_id,
      })

      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", session.campaign_id)
        .eq("user_id", userId)
        .single()

      console.log("[api/join-session] POST membership query result", {
        reqId,
        userId,
        campaignId: session.campaign_id,
        membership,
        memberError,
        errorCode: memberError?.code,
        errorMessage: memberError?.message,
      })

      if (membership) {
        hasAccess = true
        accessReason = `campaign member (${membership.role})`
        console.log("[api/join-session] POST access granted as member", { reqId, userId, role: membership.role })
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/join-session] POST membership check error", { reqId, error: memberError })
      } else {
        console.log("[api/join-session] POST no membership found", { reqId, userId, campaignId: session.campaign_id })
      }
    }

    console.log("[api/join-session] POST access check complete", {
      reqId,
      userId,
      campaignId: session.campaign_id,
      hasAccess,
      accessReason,
    })

    if (!hasAccess) {
      console.log("[api/join-session] POST access denied", {
        reqId,
        userId,
        sessionId,
        campaignId: session.campaign_id,
        campaignOwnerId: session.campaigns?.owner_id,
      })
      return NextResponse.json(
        {
          error: "Access denied. You must be invited to this campaign to join its sessions.",
        },
        { status: 403 },
      )
    }

    console.log("[api/join-session] POST access granted", { reqId, accessReason })

    // Add user to session participants if not already there
    const currentParticipants = Array.isArray(session.participants) ? session.participants : []
    console.log("[api/join-session] POST current participants", {
      reqId,
      sessionId,
      currentParticipants,
      isAlreadyParticipant: currentParticipants.includes(userId),
    })

    if (!currentParticipants.includes(userId)) {
      const updatedParticipants = [...currentParticipants, userId]

      console.log("[api/join-session] POST updating participants", {
        reqId,
        sessionId,
        oldParticipants: currentParticipants,
        newParticipants: updatedParticipants,
      })

      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          participants: updatedParticipants,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)

      if (updateError) {
        console.error("[api/join-session] POST failed to update participants", { reqId, error: updateError })
        return NextResponse.json({ error: "Failed to join session" }, { status: 500 })
      }

      console.log("[api/join-session] POST added to participants", {
        reqId,
        userId,
        sessionId,
        participantCount: updatedParticipants.length,
      })
    } else {
      console.log("[api/join-session] POST already a participant", { reqId, userId, sessionId })
    }

    // Get or create the map for this session
    console.log("[api/join-session] POST checking for map", { reqId, sessionId })
    let { data: map, error: mapError } = await supabase.from("maps").select("*").eq("session_id", sessionId).single()

    console.log("[api/join-session] POST map query result", {
      reqId,
      sessionId,
      hasMap: !!map,
      mapError,
      mapErrorCode: mapError?.code,
    })

    if (mapError && mapError.code === "PGRST116") {
      // Map doesn't exist, create it
      console.log("[api/join-session] POST creating new map", { reqId, sessionId })
      const { data: newMap, error: createMapError } = await supabase
        .from("maps")
        .insert({
          session_id: sessionId,
          grid_size: 30,
          tokens: [],
          terrain_data: null,
          background_image: null,
        })
        .select()
        .single()

      if (createMapError) {
        console.error("[api/join-session] POST failed to create map", { reqId, error: createMapError })
        // Don't fail the join if map creation fails
        map = null
      } else {
        map = newMap
        console.log("[api/join-session] POST created new map", { reqId, sessionId, mapId: newMap?.id })
      }
    } else if (mapError) {
      console.error("[api/join-session] POST map query error", { reqId, error: mapError })
      // Don't fail the join if map query fails
      map = null
    }

    console.log("[api/join-session] POST success", {
      reqId,
      sessionId,
      userId,
      campaignId: session.campaign_id,
      campaignName: session.campaigns?.name,
      accessReason,
      hasMap: !!map,
    })

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        map,
      },
      message: `Successfully joined session in campaign "${session.campaigns?.name}"`,
    })
  } catch (error: any) {
    console.error("[api/join-session] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

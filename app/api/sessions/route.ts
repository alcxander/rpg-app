import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/sessions] GET start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/sessions] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")

    if (!campaignId) {
      console.log("[api/sessions] GET missing campaignId", { reqId })
      return NextResponse.json({ error: "Campaign ID is required" }, { status: 400 })
    }

    console.log("[api/sessions] GET sessions for campaign", { reqId, campaignId, userId })

    const supabase = createAdminClient()

    // First, verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/sessions] GET campaign not found", { reqId, campaignId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user has access to this campaign
    let hasAccess = false
    let accessReason = ""

    // Check if user is the campaign owner
    if (campaign.owner_id === userId) {
      hasAccess = true
      accessReason = "campaign owner"
    } else {
      // Check if user is a member of the campaign
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership) {
        hasAccess = true
        accessReason = `campaign member (${membership.role})`
      } else if (memberError) {
        console.log("[api/sessions] GET membership check error", { reqId, error: memberError })
      }
    }

    if (!hasAccess) {
      console.log("[api/sessions] GET access denied", {
        reqId,
        userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Access denied. You must be a member of this campaign to view its sessions.",
        },
        { status: 403 },
      )
    }

    console.log("[api/sessions] GET access granted", { reqId, accessReason })

    // Get sessions for this campaign
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })

    if (sessionsError) {
      console.error("[api/sessions] GET sessions query error", { reqId, error: sessionsError })
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
    }

    console.log("[api/sessions] GET success", {
      reqId,
      campaignId,
      sessionCount: sessions?.length || 0,
      accessReason,
    })

    return NextResponse.json({
      sessions: sessions || [],
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
    })
  } catch (error: any) {
    console.error("[api/sessions] GET error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/sessions] POST start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/sessions] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, sessionId } = body

    if (!campaignId || !sessionId) {
      console.log("[api/sessions] POST missing required fields", { reqId, campaignId, sessionId })
      return NextResponse.json({ error: "Campaign ID and session ID are required" }, { status: 400 })
    }

    console.log("[api/sessions] POST creating session", { reqId, campaignId, sessionId, userId })

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/sessions] POST campaign not found", { reqId, campaignId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user has permission to create sessions (owner or DM)
    let canCreate = false
    let accessReason = ""

    if (campaign.owner_id === userId) {
      canCreate = true
      accessReason = "campaign owner"
    } else {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership && membership.role === "DM") {
        canCreate = true
        accessReason = "campaign DM"
      }
    }

    if (!canCreate) {
      console.log("[api/sessions] POST insufficient permissions", {
        reqId,
        userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Only campaign owners and DMs can create sessions",
        },
        { status: 403 },
      )
    }

    console.log("[api/sessions] POST permission granted", { reqId, accessReason })

    // Check if session ID already exists
    const { data: existingSession } = await supabase.from("sessions").select("id").eq("id", sessionId).single()

    if (existingSession) {
      console.log("[api/sessions] POST session already exists", { reqId, sessionId })
      return NextResponse.json({ error: "Session ID already exists" }, { status: 400 })
    }

    // Create the session
    const { data: newSession, error: createError } = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        campaign_id: campaignId,
        participants: [userId], // Creator is automatically a participant
        active: true,
      })
      .select()
      .single()

    if (createError) {
      console.error("[api/sessions] POST create error", { reqId, error: createError })
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    // Create the initial map for this session
    const { error: mapError } = await supabase.from("maps").insert({
      session_id: sessionId,
      grid_size: 30,
      tokens: [],
      terrain_data: null,
      background_image: null,
    })

    if (mapError) {
      console.error("[api/sessions] POST map creation error", { reqId, error: mapError })
      // Don't fail session creation if map creation fails
    }

    console.log("[api/sessions] POST success", {
      reqId,
      sessionId,
      campaignId,
      userId,
      accessReason,
    })

    return NextResponse.json({
      success: true,
      session: newSession,
      message: `Session "${sessionId}" created successfully`,
    })
  } catch (error: any) {
    console.error("[api/sessions] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

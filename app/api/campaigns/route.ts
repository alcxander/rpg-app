import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * GET /api/campaigns
 * Fetches campaigns that the user owns or is a member of
 */
export async function GET(req: NextRequest) {
  const reqId = rid()

  try {
    const { userId } = getAuth(req)
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId })

    if (!userId) {
      console.warn("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Fetch campaigns where user is owner OR member
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(`
        id,
        name,
        description,
        owner_id,
        settings,
        created_at,
        updated_at,
        campaign_members!inner (
          role,
          joined_at
        )
      `)
      .or(`owner_id.eq.${userId},campaign_members.user_id.eq.${userId}`)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[api/campaigns] GET error", { reqId, error: error.message })
      return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
    }

    // Transform the data to include user's role
    const transformedCampaigns =
      campaigns?.map((campaign) => {
        const isOwner = campaign.owner_id === userId
        const memberInfo = campaign.campaign_members?.[0]

        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          owner_id: campaign.owner_id,
          settings: campaign.settings,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
          user_role: isOwner ? "Owner" : memberInfo?.role || "Member",
          joined_at: isOwner ? campaign.created_at : memberInfo?.joined_at,
          is_owner: isOwner,
        }
      }) || []

    console.log("[api/campaigns] GET success", { reqId, count: transformedCampaigns.length })
    return NextResponse.json({ campaigns: transformedCampaigns })
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign
 */
export async function POST(req: NextRequest) {
  const reqId = rid()

  try {
    const { userId } = getAuth(req)
    console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId })

    if (!userId) {
      console.warn("[api/campaigns] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name: name.trim(),
        description: description?.trim() || "",
        owner_id: userId,
        settings: {
          players: [],
          created_by: userId,
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (campaignError) {
      console.error("[api/campaigns] POST campaign creation error", { reqId, error: campaignError.message })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    // Add creator as campaign member with DM role
    const { error: memberError } = await supabase.from("campaign_members").insert({
      campaign_id: campaign.id,
      user_id: userId,
      role: "DM",
      added_by: userId,
    })

    if (memberError) {
      console.warn("[api/campaigns] POST member creation error", { reqId, error: memberError.message })
      // Don't fail the campaign creation for this
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })
    return NextResponse.json({ campaign })
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

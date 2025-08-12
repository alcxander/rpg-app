import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseClient"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).substring(7)
}

/**
 * GET /api/campaigns
 * Fetches campaigns that the user owns or is a member of
 */
export async function GET(request: NextRequest) {
  const reqId = rid()

  try {
    console.log("[api/campaigns] GET start", { reqId, hasUser: true })

    const { userId } = await getAuth(request)

    if (!userId) {
      console.log("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createClient()

    // Get campaigns owned by user
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", userId)

    if (ownedError) {
      console.error("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member
    const { data: memberCampaigns, error: memberError } = await supabase
      .from("campaign_members")
      .select(`
        campaign_id,
        role,
        joined_at,
        campaigns (
          id,
          name,
          description,
          owner_id,
          settings,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", userId)

    if (memberError) {
      console.error("[api/campaigns] GET member campaigns error", { reqId, error: memberError })
      return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
    }

    // Combine and format results
    const allCampaigns = [
      // Owned campaigns
      ...(ownedCampaigns || []).map((campaign) => ({
        ...campaign,
        role: "Owner",
        joined_at: campaign.created_at,
      })),
      // Member campaigns
      ...(memberCampaigns || []).map((member) => ({
        ...member.campaigns,
        role: member.role,
        joined_at: member.joined_at,
      })),
    ]

    // Remove duplicates and sort by creation date
    const uniqueCampaigns = allCampaigns
      .filter((campaign, index, self) => index === self.findIndex((c) => c.id === campaign.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      userId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns?.length || 0,
      totalCount: uniqueCampaigns.length,
    })

    return NextResponse.json(uniqueCampaigns)
  } catch (error) {
    console.error("[api/campaigns] GET error", {
      reqId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign
 */
export async function POST(request: NextRequest) {
  const reqId = rid()

  try {
    console.log("[api/campaigns] POST start", { reqId })

    const { userId } = await getAuth(request)

    if (!userId) {
      console.log("[api/campaigns] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, settings } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name,
        description: description || "",
        owner_id: userId,
        settings: settings || {},
      })
      .select()
      .single()

    if (campaignError) {
      console.error("[api/campaigns] POST campaign creation error", { reqId, error: campaignError })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    // Add the owner as a member with Owner role
    const { error: memberError } = await supabase.from("campaign_members").insert({
      campaign_id: campaign.id,
      user_id: userId,
      role: "Owner",
      added_by: userId,
    })

    if (memberError) {
      console.error("[api/campaigns] POST member creation error", { reqId, error: memberError })
      // Don't fail the request, just log the error
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })

    return NextResponse.json({
      ...campaign,
      role: "Owner",
      joined_at: campaign.created_at,
    })
  } catch (error) {
    console.error("[api/campaigns] POST error", {
      reqId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

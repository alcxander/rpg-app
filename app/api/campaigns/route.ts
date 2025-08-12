import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

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

    const supabase = createAdminClient()

    // Get campaigns owned by user
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", userId)

    if (ownedError) {
      console.log("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError.message })
      throw ownedError
    }

    // Get campaigns where user is a member
    const { data: memberCampaigns, error: memberError } = await supabase
      .from("campaign_members")
      .select(`
        campaign_id,
        role,
        joined_at,
        campaigns (*)
      `)
      .eq("user_id", userId)

    if (memberError) {
      console.log("[api/campaigns] GET member campaigns error", { reqId, error: memberError.message })
      throw memberError
    }

    // Combine and format results
    const allCampaigns = [
      // Owned campaigns
      ...ownedCampaigns.map((campaign) => ({
        ...campaign,
        role: "Owner",
        joined_at: campaign.created_at,
      })),
      // Member campaigns
      ...memberCampaigns
        .filter((member) => member.campaigns) // Filter out null campaigns
        .map((member) => ({
          ...member.campaigns,
          role: member.role,
          joined_at: member.joined_at,
        })),
    ]

    // Remove duplicates (in case user is both owner and member)
    const uniqueCampaigns = allCampaigns.filter(
      (campaign, index, self) => index === self.findIndex((c) => c.id === campaign.id),
    )

    // Sort by creation date
    uniqueCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      userId,
      ownedCount: ownedCampaigns.length,
      memberCount: memberCampaigns.length,
      totalCount: uniqueCampaigns.length,
    })

    return NextResponse.json(uniqueCampaigns)
  } catch (error: any) {
    console.log("[api/campaigns] GET error", {
      reqId,
      error: error.message || error.toString(),
    })
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }
}

/**
 * POST /api/campaigns
 * Creates a new campaign
 */
export async function POST(request: NextRequest) {
  const reqId = rid()

  try {
    const { userId } = await getAuth(request)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name,
        description: description || "",
        owner_id: userId,
        settings: {
          players: [],
          shop_enabled: false,
        },
      })
      .select()
      .single()

    if (campaignError) {
      console.log("[api/campaigns] POST campaign error", { reqId, error: campaignError.message })
      throw campaignError
    }

    // Add owner as campaign member
    const { error: memberError } = await supabase.from("campaign_members").insert({
      campaign_id: campaign.id,
      user_id: userId,
      role: "Owner",
      added_by: userId,
    })

    if (memberError) {
      console.log("[api/campaigns] POST member error", { reqId, error: memberError.message })
      // Don't throw - campaign is created, member record is nice-to-have
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })

    return NextResponse.json(campaign, { status: 201 })
  } catch (error: any) {
    console.log("[api/campaigns] POST error", {
      reqId,
      error: error.message || error.toString(),
    })
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}

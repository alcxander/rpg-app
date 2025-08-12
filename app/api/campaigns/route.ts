import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns] GET start", { reqId, hasUser: true })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get campaigns owned by user
    console.log("[api/campaigns] GET fetching owned campaigns", { reqId, userId })
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("created_by", userId)

    if (ownedError) {
      console.log("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError.message })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member (with graceful fallback if table doesn't exist)
    let memberCampaigns: any[] = []
    try {
      console.log("[api/campaigns] GET fetching member campaigns", { reqId, userId })
      const { data: memberData, error: memberError } = await supabase
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
        // If campaign_members table doesn't exist, continue with just owned campaigns
        if (memberError.message.includes("does not exist") || memberError.message.includes("schema cache")) {
          console.log("[api/campaigns] GET campaign_members table not found, using owned campaigns only", { reqId })
        } else {
          throw memberError
        }
      } else {
        memberCampaigns =
          memberData?.map((m) => ({
            ...m.campaigns,
            user_role: m.role,
            joined_at: m.joined_at,
          })) || []
      }
    } catch (error: any) {
      console.log("[api/campaigns] GET member campaigns error", { reqId, error: error.message })
      // Continue with just owned campaigns if member table query fails
    }

    // Combine owned and member campaigns, avoiding duplicates
    const ownedIds = new Set(ownedCampaigns?.map((c) => c.id) || [])
    const uniqueMemberCampaigns = memberCampaigns.filter((c) => !ownedIds.has(c.id))

    const allCampaigns = [...(ownedCampaigns?.map((c) => ({ ...c, user_role: "DM" })) || []), ...uniqueMemberCampaigns]

    // Sort by creation date
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns.length,
      totalCount: allCampaigns.length,
    })

    return NextResponse.json({ campaigns: allCampaigns })
  } catch (error: any) {
    console.error("[api/campaigns] GET error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns] POST start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      console.log("[api/campaigns] POST missing name", { reqId })
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    console.log("[api/campaigns] POST creating campaign", { reqId, name, userId })
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        name,
        description: description || "",
        created_by: userId,
        settings: {
          players: [],
          shop_enabled: false,
        },
      })
      .select()
      .single()

    if (error) {
      console.log("[api/campaigns] POST create error", { reqId, error: error.message })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })
    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error("[api/campaigns] POST error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

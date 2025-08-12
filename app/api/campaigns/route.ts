import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { userId } = await getAuth(request)
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId })

    if (!userId) {
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
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member (with graceful fallback)
    let memberCampaigns: any[] = []
    try {
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
        // If campaign_members table doesn't exist, gracefully continue with empty array
        if (!memberError.message.includes("does not exist") && !memberError.message.includes("schema cache")) {
          return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
        }
      } else if (memberData) {
        memberCampaigns = memberData
          .filter((member) => member.campaigns)
          .map((member) => ({
            ...member.campaigns,
            user_role: member.role,
            joined_at: member.joined_at,
          }))
      }
    } catch (error: any) {
      console.log("[api/campaigns] GET member campaigns error", { reqId, error: error.message })
      // Continue with empty member campaigns if table doesn't exist
    }

    // Combine and deduplicate campaigns
    const allCampaigns = [...(ownedCampaigns || []), ...memberCampaigns]
    const uniqueCampaigns = allCampaigns.reduce((acc, campaign) => {
      const existing = acc.find((c) => c.id === campaign.id)
      if (!existing) {
        acc.push({
          ...campaign,
          user_role: campaign.owner_id === userId ? "DM" : campaign.user_role || "Player",
        })
      }
      return acc
    }, [] as any[])

    // Sort by creation date
    uniqueCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns.length,
      totalCount: uniqueCampaigns.length,
    })

    return NextResponse.json({ campaigns: uniqueCampaigns })
  } catch (error: any) {
    console.error("[api/campaigns] GET error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { userId } = await getAuth(request)
    console.log("[api/campaigns] POST start", { reqId, hasUser: !!userId })

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: campaign, error } = await supabase
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

    if (error) {
      console.log("[api/campaigns] POST error", { reqId, error: error.message })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })
    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error("[api/campaigns] POST error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

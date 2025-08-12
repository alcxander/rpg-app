import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { userId } = await getAuth(request)
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId })

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
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member (with graceful fallback if table doesn't exist)
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
        // If campaign_members table doesn't exist, continue with just owned campaigns
        if (memberError.message.includes("does not exist") || memberError.message.includes("schema cache")) {
          console.log("[api/campaigns] campaign_members table not found, using owned campaigns only", { reqId })
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
      // Continue with just owned campaigns if member query fails
    }

    // Combine and deduplicate campaigns
    const allCampaigns = [...(ownedCampaigns || [])]

    // Add member campaigns that aren't already owned
    memberCampaigns.forEach((memberCampaign) => {
      if (!allCampaigns.find((c) => c.id === memberCampaign.id)) {
        allCampaigns.push(memberCampaign)
      }
    })

    // Sort by created_at descending
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns.length,
      totalCount: allCampaigns.length,
    })

    return NextResponse.json(allCampaigns)
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

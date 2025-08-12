import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns] GET start", { reqId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[api/campaigns] GET authenticated user", { reqId, userId })

    const supabase = createAdminClient()

    // First, get campaigns owned by the user
    console.log("[api/campaigns] GET fetching owned campaigns", { reqId, userId })
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", userId)

    if (ownedError) {
      console.error("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    console.log("[api/campaigns] GET owned campaigns result", {
      reqId,
      count: ownedCampaigns?.length || 0,
      campaigns: ownedCampaigns?.map((c) => ({ id: c.id, name: c.name })) || [],
    })

    // Then, get campaigns where user is a member
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
        console.error("[api/campaigns] GET member campaigns error", { reqId, error: memberError })
      } else if (memberData) {
        console.log("[api/campaigns] GET member campaigns result", {
          reqId,
          count: memberData?.length || 0,
          members: memberData?.map((m) => ({ campaign_id: m.campaign_id, role: m.role })) || [],
        })
        memberCampaigns = memberData.map((member) => ({
          ...member.campaigns,
          user_role: member.role,
          joined_at: member.joined_at,
        }))
      }
    } catch (error) {
      console.log("[api/campaigns] GET member campaigns table error", { reqId, error: (error as Error).message })
    }

    // Combine owned and member campaigns, avoiding duplicates
    const allCampaigns = [...(ownedCampaigns || [])]

    // Add member campaigns that aren't already owned
    memberCampaigns.forEach((memberCampaign) => {
      if (!allCampaigns.find((owned) => owned.id === memberCampaign.id)) {
        allCampaigns.push(memberCampaign)
      }
    })

    // Sort by created_at descending
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET final result", {
      reqId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns.length,
      totalCount: allCampaigns.length,
      finalCampaigns: allCampaigns.map((c) => ({ id: c.id, name: c.name, owner_id: c.owner_id })),
    })

    return NextResponse.json({ campaigns: allCampaigns })
  } catch (error) {
    console.error("[api/campaigns] GET error", {
      reqId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    })
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
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
    const { name } = body

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
        owner_id: userId,
        settings: {
          players: [],
          shop_enabled: false,
        },
      })
      .select()
      .single()

    if (error) {
      console.error("[api/campaigns] POST create error", { reqId, error: error.message, details: error })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })
    return NextResponse.json({ campaign })
  } catch (error: any) {
    console.error("[api/campaigns] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

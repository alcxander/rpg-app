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
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", userId)

    if (ownedError) {
      console.log("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError.message })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member (only if campaign_members table exists)
    let memberCampaigns = []
    try {
      const { data, error: memberError } = await supabase
        .from("campaign_members")
        .select(`
          role,
          joined_at,
          campaigns (*)
        `)
        .eq("user_id", userId)

      if (memberError) {
        console.log("[api/campaigns] GET member campaigns error", { reqId, error: memberError.message })
        // Don't fail the request if campaign_members table doesn't exist yet
        if (!memberError.message.includes("Could not find the table")) {
          return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
        }
      } else {
        memberCampaigns = data || []
      }
    } catch (error) {
      console.log("[api/campaigns] GET member campaigns catch", { reqId, error })
      // Continue without member campaigns if table doesn't exist
    }

    // Combine and format results
    const allCampaigns = [
      ...ownedCampaigns.map((campaign) => ({
        ...campaign,
        role: "Owner",
        joined_at: campaign.created_at,
      })),
      ...memberCampaigns.map((member) => ({
        ...member.campaigns,
        role: member.role,
        joined_at: member.joined_at,
      })),
    ]

    // Sort by creation date
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", { reqId, count: allCampaigns.length })
    return NextResponse.json(allCampaigns)
  } catch (error) {
    console.log("[api/campaigns] GET error", {
      reqId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
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
    const { name, description, settings } = body

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name,
        description: description || "",
        owner_id: userId,
        settings: settings || { players: [] },
      })
      .select()
      .single()

    if (campaignError) {
      console.error("[api/campaigns] POST campaign creation error", { reqId, error: campaignError })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    // Try to add the owner as a member (only if campaign_members table exists)
    try {
      const { error: memberError } = await supabase.from("campaign_members").insert({
        campaign_id: campaign.id,
        user_id: userId,
        role: "Owner",
        added_by: userId,
      })

      if (memberError) {
        console.error("[api/campaigns] POST member creation error", { reqId, error: memberError })
        // Don't fail the request if table doesn't exist yet
      }
    } catch (error) {
      console.log("[api/campaigns] POST member creation catch", { reqId, error })
      // Continue without member record if table doesn't exist
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
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

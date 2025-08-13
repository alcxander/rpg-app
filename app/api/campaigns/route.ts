import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

export async function GET() {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns] GET start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[api/campaigns] GET processing", { reqId, hasUser: !!userId })

    const supabase = createAdminClient()

    // Get campaigns owned by the user
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })

    if (ownedError) {
      console.error("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Get campaigns where user is a member
    const { data: memberCampaigns, error: memberError } = await supabase
      .from("campaign_members")
      .select(`
        role,
        joined_at,
        campaigns (*)
      `)
      .eq("user_id", userId)

    if (memberError) {
      console.error("[api/campaigns] GET member campaigns error", { reqId, error: memberError })
      return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
    }

    // Combine and format campaigns
    const allCampaigns = []

    // Add owned campaigns
    if (ownedCampaigns) {
      for (const campaign of ownedCampaigns) {
        allCampaigns.push({
          ...campaign,
          is_owner: true,
          is_member: false,
          member_role: null,
        })
      }
    }

    // Add member campaigns
    if (memberCampaigns) {
      for (const membership of memberCampaigns) {
        if (membership.campaigns) {
          allCampaigns.push({
            ...membership.campaigns,
            is_owner: false,
            is_member: true,
            member_role: membership.role,
            joined_at: membership.joined_at,
          })
        }
      }
    }

    // Sort by created_at descending
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns?.length || 0,
      totalCount: allCampaigns.length,
      finalCampaigns: allCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        owner_id: c.owner_id,
        is_owner: c.is_owner,
        is_member: c.is_member,
        member_role: c.member_role,
      })),
    })

    return NextResponse.json({ campaigns: allCampaigns })
  } catch (error: any) {
    console.error("[api/campaigns] GET error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    console.log("[api/campaigns] POST start", { reqId })

    const { userId, getToken } = await auth()
    if (!userId || !getToken) {
      console.log("[api/campaigns] POST unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      console.log("[api/campaigns] POST invalid name", { reqId, name })
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 })
    }

    console.log("[api/campaigns] POST creating campaign", { reqId, name: name.trim(), userId })

    const supabase = createAdminClient()

    // Create the campaign
    const { data: campaign, error: createError } = await supabase
      .from("campaigns")
      .insert({
        name: name.trim(),
        owner_id: userId,
      })
      .select()
      .single()

    if (createError) {
      console.error("[api/campaigns] POST create error", { reqId, error: createError })
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    console.log("[api/campaigns] POST success", {
      reqId,
      campaignId: campaign.id,
      name: campaign.name,
      ownerId: campaign.owner_id,
    })

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        is_owner: true,
        is_member: false,
        member_role: null,
      },
      message: `Campaign "${campaign.name}" created successfully`,
    })
  } catch (error: any) {
    console.error("[api/campaigns] POST error", { reqId, error: error.message, stack: error.stack })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

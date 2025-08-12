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
    console.log("[api/campaigns] GET start", { reqId, hasUser: !!userId, userId })

    if (!userId) {
      console.warn("[api/campaigns] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // First, get campaigns where user is the owner
    const { data: ownedCampaigns, error: ownedError } = await supabase
      .from("campaigns")
      .select("id, name, description, owner_id, settings, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })

    if (ownedError) {
      console.error("[api/campaigns] GET owned campaigns error", { reqId, error: ownedError.message })
      return NextResponse.json({ error: "Failed to fetch owned campaigns" }, { status: 500 })
    }

    // Then, get campaigns where user is a member
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
      .neq("role", "Owner") // Exclude owner role to avoid duplicates

    if (memberError) {
      console.error("[api/campaigns] GET member campaigns error", { reqId, error: memberError.message })
      return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
    }

    // Combine and transform the results
    const allCampaigns = []

    // Add owned campaigns
    if (ownedCampaigns) {
      for (const campaign of ownedCampaigns) {
        allCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          owner_id: campaign.owner_id,
          settings: campaign.settings,
          created_at: campaign.created_at,
          updated_at: campaign.updated_at,
          user_role: "Owner",
          joined_at: campaign.created_at,
          is_owner: true,
        })
      }
    }

    // Add member campaigns
    if (memberCampaigns) {
      for (const member of memberCampaigns) {
        if (member.campaigns) {
          allCampaigns.push({
            id: member.campaigns.id,
            name: member.campaigns.name,
            description: member.campaigns.description,
            owner_id: member.campaigns.owner_id,
            settings: member.campaigns.settings,
            created_at: member.campaigns.created_at,
            updated_at: member.campaigns.updated_at,
            user_role: member.role,
            joined_at: member.joined_at,
            is_owner: false,
          })
        }
      }
    }

    // Sort by created_at descending
    allCampaigns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    console.log("[api/campaigns] GET success", {
      reqId,
      totalCount: allCampaigns.length,
      ownedCount: ownedCampaigns?.length || 0,
      memberCount: memberCampaigns?.length || 0,
    })

    return NextResponse.json({ campaigns: allCampaigns })
  } catch (e: any) {
    console.error("[api/campaigns] GET exception", { reqId, message: e?.message, stack: e?.stack })
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

    // Add creator as campaign member with Owner role
    const { error: memberError } = await supabase.from("campaign_members").insert({
      campaign_id: campaign.id,
      user_id: userId,
      role: "Owner",
      added_by: userId,
    })

    if (memberError) {
      console.warn("[api/campaigns] POST member creation error", { reqId, error: memberError.message })
      // Don't fail the campaign creation for this
    }

    console.log("[api/campaigns] POST success", { reqId, campaignId: campaign.id })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (e: any) {
    console.error("[api/campaigns] POST exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

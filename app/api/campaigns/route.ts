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
      console.log("[api/campaigns] GET member campaigns error", { reqId, error: memberError.message })
      return NextResponse.json({ error: "Failed to fetch member campaigns" }, { status: 500 })
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

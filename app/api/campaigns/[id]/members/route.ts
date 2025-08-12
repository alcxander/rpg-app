import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)
  const { id: campaignId } = await params

  try {
    console.log("[api/campaigns/members] GET start", { reqId, campaignId })

    const { userId } = await getAuth(request)

    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: userAccess, error: accessError } = await supabase
      .from("campaign_members")
      .select("role")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    // Also check if user is campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    const hasAccess = userAccess || (campaign && campaign.owner_id === userId)

    if (!hasAccess) {
      console.log("[api/campaigns/members] GET no access", { reqId, userId, campaignId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all campaign members with user details
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
        added_by,
        users (
          id,
          email,
          name,
          image_url
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (membersError) {
      console.log("[api/campaigns/members] GET members error", { reqId, error: membersError.message })
      throw membersError
    }

    console.log("[api/campaigns/members] GET success", {
      reqId,
      campaignId,
      memberCount: members?.length || 0,
    })

    return NextResponse.json(members || [])
  } catch (error: any) {
    console.log("[api/campaigns/members] GET error", {
      reqId,
      campaignId,
      error: error.message || error.toString(),
    })
    return NextResponse.json({ error: "Failed to fetch campaign members" }, { status: 500 })
  }
}

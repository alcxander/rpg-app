import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * GET /api/campaigns/:id/members
 * Returns campaign members with user details
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = rid()
  const { id: campaignId } = await params

  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/campaigns/members] GET start", { reqId, hasUser: !!userId, sessionId, campaignId })

    if (!userId) {
      console.warn("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: membership, error: membershipError } = await supabase
      .from("campaign_members")
      .select("role")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    if (membershipError || !membership) {
      // Also check if user is campaign owner
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("owner_id")
        .eq("id", campaignId)
        .single()

      if (campaignError || !campaign || campaign.owner_id !== userId) {
        console.warn("[api/campaigns/members] Access denied", { reqId, userId, campaignId })
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Get campaign members with user details
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
        added_by,
        users!campaign_members_user_id_fkey (
          id,
          name,
          email,
          image_url
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (membersError) {
      console.error("[api/campaigns/members] Query error", { reqId, error: membersError.message })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    console.log("[api/campaigns/members] GET done", { reqId, count: members?.length ?? 0 })
    return NextResponse.json({ members: members ?? [] })
  } catch (e: any) {
    console.error("[api/campaigns/members] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

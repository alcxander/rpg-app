import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * GET /api/campaigns/:id/members
 * Gets all members of a campaign
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = rid()
  const { id: campaignId } = await params

  try {
    const { userId } = getAuth(req)
    console.log("[api/campaigns/members] GET start", { reqId, campaignId, hasUser: !!userId })

    if (!userId) {
      console.warn("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Step 1: Verify user has access to this campaign
    const { data: userMembership, error: membershipError } = await supabase
      .from("campaign_members")
      .select("role")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    // Also check if user is the owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    const isOwner = campaign?.owner_id === userId
    const isMember = !!userMembership && !membershipError

    if (!isOwner && !isMember) {
      console.warn("[api/campaigns/members] Access denied", { reqId, userId, isOwner, isMember })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Step 2: Get all campaign members
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
          name,
          email,
          image_url
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (membersError) {
      console.error("[api/campaigns/members] Error fetching members", { reqId, error: membersError.message })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Transform the data
    const transformedMembers =
      members?.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        added_by: member.added_by,
        name: member.users?.name || "Unknown User",
        email: member.users?.email || "",
        image_url: member.users?.image_url || null,
      })) || []

    console.log("[api/campaigns/members] GET success", { reqId, memberCount: transformedMembers.length })
    return NextResponse.json({ members: transformedMembers })
  } catch (e: any) {
    console.error("[api/campaigns/members] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

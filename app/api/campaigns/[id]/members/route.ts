import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"

/**
 * GET /api/campaigns/:id/members
 * Fetches all members of a campaign
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params

  try {
    const { userId } = getAuth(req)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: userMembership, error: membershipError } = await supabase
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

    const isOwner = campaign?.owner_id === userId
    const isMember = !!userMembership && !membershipError

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch all campaign members with user details
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        id,
        user_id,
        role,
        joined_at,
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
      console.error("Error fetching campaign members:", membersError)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    return NextResponse.json({
      members: members || [],
      total: members?.length || 0,
    })
  } catch (error) {
    console.error("GET /api/campaigns/[id]/members error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

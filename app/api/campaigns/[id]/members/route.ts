import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { id: campaignId } = await params
    console.log("[api/campaigns/members] GET start", { reqId, campaignId })

    const { userId } = await getAuth(request)
    if (!userId) {
      console.log("[api/campaigns/members] GET unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/campaigns/members] GET campaign not found", { reqId, error: campaignError?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user is owner or member
    let hasAccess = campaign.owner_id === userId

    if (!hasAccess) {
      try {
        const { data: membership, error: memberError } = await supabase
          .from("campaign_members")
          .select("id")
          .eq("campaign_id", campaignId)
          .eq("user_id", userId)
          .single()

        if (membership) {
          hasAccess = true
        }
      } catch (error) {
        // campaign_members table might not exist yet
        console.log("[api/campaigns/members] GET membership check failed", { reqId, error: (error as Error).message })
      }
    }

    if (!hasAccess) {
      console.log("[api/campaigns/members] GET access denied", { reqId, userId, campaignId })
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get campaign members
    let members: any[] = []

    try {
      const { data: memberData, error: memberError } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("joined_at", { ascending: true })

      if (memberError) {
        console.log("[api/campaigns/members] GET members query error", { reqId, error: memberError.message })
      } else if (memberData) {
        members = memberData
      }
    } catch (error) {
      console.log("[api/campaigns/members] GET members table not found", { reqId, error: (error as Error).message })
      // Table doesn't exist yet, return empty array
    }

    // Add campaign owner if not already in members
    const ownerInMembers = members.find((m) => m.user_id === campaign.owner_id)
    if (!ownerInMembers) {
      members.unshift({
        id: "owner",
        campaign_id: campaignId,
        user_id: campaign.owner_id,
        role: "DM",
        joined_at: campaign.created_at,
        added_by: null,
      })
    }

    // Enrich with user data if users table exists
    try {
      const userIds = members.map((m) => m.user_id)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .in("id", userIds)

      if (userData && !userError) {
        members = members.map((member) => {
          const user = userData.find((u) => u.id === member.user_id)
          return {
            ...member,
            user: user || { id: member.user_id, name: "Unknown User", email: null, avatar_url: null },
          }
        })
      }
    } catch (error) {
      console.log("[api/campaigns/members] GET user enrichment failed", { reqId, error: (error as Error).message })
      // Add basic user info
      members = members.map((member) => ({
        ...member,
        user: {
          id: member.user_id,
          name: member.user_id,
          email: null,
          avatar_url: null,
        },
      }))
    }

    console.log("[api/campaigns/members] GET success", { reqId, memberCount: members.length })

    return NextResponse.json(members)
  } catch (error) {
    console.error("[api/campaigns/members] GET error", { reqId, error: (error as Error).message })
    return NextResponse.json({ error: "Failed to fetch campaign members" }, { status: 500 })
  }
}

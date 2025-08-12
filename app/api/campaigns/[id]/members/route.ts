import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { userId } = await getAuth(request)
    const { id: campaignId } = await params

    console.log("[api/campaigns/members] GET start", { reqId, userId, campaignId })

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Verify user has access to this campaign (owner or member)
    const { data: campaign } = await supabase.from("campaigns").select("owner_id").eq("id", campaignId).single()

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === userId

    // Check if user is a member if not owner
    if (!isOwner) {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Get campaign members with user details
    const { data: members, error: membersError } = await supabase
      .from("campaign_members")
      .select(`
        *,
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
      console.log("[api/campaigns/members] Failed to fetch members", { reqId, error: membersError.message })
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    // Also include the campaign owner if they're not in members table
    const { data: owner } = await supabase
      .from("users")
      .select("id, name, email, image_url")
      .eq("id", campaign.owner_id)
      .single()

    const ownerAsMember = {
      id: "owner",
      campaign_id: campaignId,
      user_id: campaign.owner_id,
      role: "DM",
      joined_at: null,
      added_by: null,
      users: owner,
    }

    // Combine owner and members, avoiding duplicates
    const allMembers = [ownerAsMember]
    if (members) {
      members.forEach((member) => {
        if (member.user_id !== campaign.owner_id) {
          allMembers.push(member)
        }
      })
    }

    console.log("[api/campaigns/members] GET success", { reqId, memberCount: allMembers.length })

    return NextResponse.json(allMembers)
  } catch (error: any) {
    console.error("[api/campaigns/members] GET error", { reqId, error: error.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

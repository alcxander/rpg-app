import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseClient"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { id: campaignId } = await params
    const { userId } = await getAuth(request)

    console.log("[api/campaigns/members] GET start", { reqId, campaignId, userId })

    if (!userId) {
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
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user is owner or member
    const isOwner = campaign.owner_id === userId

    const { data: membership } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    if (!isOwner && !membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all campaign members with user details
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

    // Add campaign owner to the list if not already a member
    const ownerIsMember = members?.some((m) => m.user_id === campaign.owner_id)

    if (!ownerIsMember) {
      const { data: ownerUser } = await supabase
        .from("users")
        .select("id, name, email, image_url")
        .eq("id", campaign.owner_id)
        .single()

      if (ownerUser) {
        members?.unshift({
          id: "owner",
          campaign_id: campaignId,
          user_id: campaign.owner_id,
          role: "Owner",
          joined_at: campaign.created_at,
          added_by: null,
          users: ownerUser,
        })
      }
    }

    console.log("[api/campaigns/members] GET success", { reqId, memberCount: members?.length || 0 })

    return NextResponse.json(members || [])
  } catch (error) {
    console.log("[api/campaigns/members] GET error", {
      reqId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(7)

  try {
    const { id: campaignId } = await params
    console.log("[api/campaigns/members] DELETE start", { reqId, campaignId })

    const { userId } = await getAuth(request)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberUserId = searchParams.get("userId")

    if (!memberUserId) {
      return NextResponse.json({ error: "Member user ID is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify user is campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      return NextResponse.json({ error: "Only campaign owners can remove members" }, { status: 403 })
    }

    if (memberUserId === userId) {
      return NextResponse.json({ error: "Cannot remove yourself from campaign" }, { status: 400 })
    }

    // Remove from campaign_members (this will cascade to other tables)
    const { error: removeError } = await supabase
      .from("campaign_members")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", memberUserId)

    if (removeError) {
      console.error("[api/campaigns/members] Failed to remove member", { reqId, error: removeError })
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    console.log("[api/campaigns/members] DELETE success", { reqId, campaignId, memberUserId })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/campaigns/members] DELETE error", {
      reqId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

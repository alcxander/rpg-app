import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { campaignId } = params
    const supabase = createServerClient()

    // Verify user has access to this campaign
    const { data: campaign } = await supabase.from("campaigns").select("owner_id").eq("id", campaignId).single()

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === userId
    if (!isOwner) {
      const { data: membership } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Get campaign members with user details
    const { data: members, error } = await supabase
      .from("campaign_members")
      .select(`
        *,
        users:user_id (
          id,
          name,
          clerk_id
        )
      `)
      .eq("campaign_id", campaignId)
      .order("joined_at", { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ members })
  } catch (error) {
    console.error("Get members error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

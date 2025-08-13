import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  console.log("[players/gold] GET request received")

  try {
    const user = await currentUser()
    if (!user) {
      console.log("[players/gold] No authenticated user")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")
    const playerId = searchParams.get("playerId") // For player-side requests

    console.log("[players/gold] Request params:", {
      campaignId,
      playerId,
      requestingUser: user.id,
    })

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // First check if user is campaign owner
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single()

    if (campaignError) {
      console.error("[players/gold] Campaign not found:", campaignError)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === user.id
    console.log("[players/gold] Ownership check:", { isOwner, campaignOwnerId: campaign.owner_id, userId: user.id })

    // If not owner, check membership
    let isMember = false
    if (!isOwner) {
      const { data: membership } = await supabaseAdmin
        .from("campaign_members")
        .select("user_id, role")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .single()

      isMember = !!membership
      console.log("[players/gold] Membership check:", { isMember, membership })
    }

    if (!isOwner && !isMember) {
      console.log("[players/gold] Access denied: not owner or member")
      return NextResponse.json({ error: "Not authorized for this campaign" }, { status: 403 })
    }

    if (playerId) {
      // Player-side request: get specific player's gold
      console.log("[players/gold] Player-side request for:", playerId)

      // Verify requesting user is either the player or the campaign owner
      if (user.id !== playerId && !isOwner) {
        console.log("[players/gold] Access denied: not owner or self")
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      // Check if the target player has access to this campaign
      if (!isOwner) {
        const { data: targetMembership } = await supabaseAdmin
          .from("campaign_members")
          .select("user_id, role")
          .eq("campaign_id", campaignId)
          .eq("user_id", playerId)
          .single()

        if (!targetMembership && playerId !== campaign.owner_id) {
          console.log("[players/gold] Target player not in campaign")
          return NextResponse.json({ error: "Player not in campaign" }, { status: 404 })
        }
      }

      // Get the player's gold using admin client (bypasses RLS)
      const { data: goldData, error: goldError } = await supabaseAdmin
        .from("players_gold")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("player_id", playerId)
        .single()

      if (goldError && goldError.code !== "PGRST116") {
        console.error("[players/gold] Error fetching player gold:", goldError)
        return NextResponse.json({ error: "Database error" }, { status: 500 })
      }

      // If no gold record exists, return default
      const playerGold = goldData || {
        player_id: playerId,
        campaign_id: campaignId,
        gold_amount: 0,
      }

      console.log("[players/gold] Player gold found:", playerGold)
      return NextResponse.json({ rows: [playerGold] })
    } else {
      // DM-side request: get all players' gold
      if (!isOwner) {
        console.log("[players/gold] Access denied: not owner")
        return NextResponse.json({ error: "Owner access required" }, { status: 403 })
      }

      console.log("[players/gold] DM-side request: fetching all players")

      // Get all campaign members with their profiles
      const { data: membersData, error: membersError } = await supabaseAdmin
        .from("campaign_members")
        .select(`
          user_id,
          role,
          joined_at,
          users!inner(
            clerk_id,
            name
          )
        `)
        .eq("campaign_id", campaignId)

      if (membersError) {
        console.error("[players/gold] Error fetching members:", membersError)
        return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
      }

      console.log("[players/gold] Members found:", membersData?.length || 0)

      // Get gold data for all members
      const { data: goldData, error: goldError } = await supabaseAdmin
        .from("players_gold")
        .select("*")
        .eq("campaign_id", campaignId)

      if (goldError) {
        console.error("[players/gold] Error fetching gold data:", goldError)
        return NextResponse.json({ error: "Failed to fetch gold data" }, { status: 500 })
      }

      console.log("[players/gold] Gold records found:", goldData?.length || 0)

      // Combine member and gold data
      const combinedData = (membersData || []).map((member) => {
        const goldRecord = goldData?.find((g) => g.player_id === member.user_id)
        return {
          player_id: member.user_id,
          player_clerk_id: member.users.clerk_id,
          player_name: member.users.name || "Unknown",
          role: member.role,
          joined_at: member.joined_at,
          gold_amount: goldRecord?.gold_amount || 0,
        }
      })

      // Also include the campaign owner if they have gold
      const { data: ownerGold } = await supabaseAdmin
        .from("players_gold")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("player_id", campaign.owner_id)
        .single()

      if (ownerGold) {
        const { data: ownerProfile } = await supabaseAdmin
          .from("users")
          .select("name, clerk_id")
          .eq("clerk_id", campaign.owner_id)
          .single()

        combinedData.unshift({
          player_id: campaign.owner_id,
          player_clerk_id: campaign.owner_id,
          player_name: ownerProfile?.name || "Campaign Owner",
          role: "Owner",
          joined_at: new Date().toISOString(),
          gold_amount: ownerGold.gold_amount || 0,
        })
      }

      console.log("[players/gold] Combined data:", combinedData.length)
      return NextResponse.json({ rows: combinedData })
    }
  } catch (error) {
    console.error("[players/gold] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log("[players/gold] POST request received")

  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, campaignId, goldAmount } = await request.json()
    console.log("[players/gold] POST data:", { playerId, campaignId, goldAmount })

    if (!playerId || !campaignId || goldAmount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Check if requesting user is campaign owner
    const { data: campaign } = await supabaseAdmin.from("campaigns").select("owner_id").eq("id", campaignId).single()

    if (!campaign || campaign.owner_id !== user.id) {
      console.log("[players/gold] Access denied: not owner")
      return NextResponse.json({ error: "Owner access required" }, { status: 403 })
    }

    // Verify target player is in campaign or is the owner
    if (playerId !== campaign.owner_id) {
      const { data: targetMembership } = await supabaseAdmin
        .from("campaign_members")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("user_id", playerId)
        .single()

      if (!targetMembership) {
        return NextResponse.json({ error: "Player not in campaign" }, { status: 404 })
      }
    }

    // Update or insert gold record
    const { data, error } = await supabaseAdmin
      .from("players_gold")
      .upsert({
        player_id: playerId,
        campaign_id: campaignId,
        gold_amount: goldAmount,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[players/gold] Upsert error:", error)
      return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
    }

    console.log("[players/gold] Gold updated successfully:", data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[players/gold] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

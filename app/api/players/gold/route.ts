import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get("campaignId")
    const playerId = searchParams.get("playerId")

    console.log("[players/gold] GET request:", { userId, campaignId, playerId })

    if (!campaignId) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 })
    }

    const supabase = createClient()

    if (playerId) {
      // Player-side view: fetch specific player's gold
      console.log("[players/gold] Fetching gold for specific player:", playerId)

      // Verify access: user must be either the player themselves OR the campaign owner
      if (playerId !== userId) {
        // Check if requesting user is the campaign owner
        const { data: campaign, error: campaignError } = await supabase
          .from("campaigns")
          .select("dm_user_id")
          .eq("id", campaignId)
          .single()

        if (campaignError || !campaign) {
          console.error("[players/gold] Campaign fetch error:", campaignError)
          return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
        }

        if (campaign.dm_user_id !== userId) {
          console.log("[players/gold] Access denied - not player or DM")
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }
      }

      // Verify player is a campaign member
      const { data: membership, error: membershipError } = await supabase
        .from("campaign_members")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", playerId)
        .single()

      if (membershipError || !membership) {
        console.log("[players/gold] Player not a campaign member:", { playerId, campaignId })
        return NextResponse.json({ error: "Player not found in campaign" }, { status: 404 })
      }

      // Fetch player's gold using admin client to bypass RLS
      const { data: goldData, error: goldError } = await supabase
        .from("players_gold")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("player_id", playerId)

      if (goldError) {
        console.error("[players/gold] Gold fetch error:", goldError)
        return NextResponse.json({ error: "Failed to fetch gold data" }, { status: 500 })
      }

      console.log("[players/gold] Gold data fetched:", goldData)

      // Return player's gold (default to 0 if no record)
      const playerGold = goldData?.[0] || {
        player_id: playerId,
        campaign_id: campaignId,
        gold_amount: 0,
      }

      return NextResponse.json({
        rows: [playerGold],
      })
    } else {
      // DM view: fetch all players' gold in the campaign
      console.log("[players/gold] Fetching all players gold for DM")

      // Verify user is the campaign owner
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("dm_user_id")
        .eq("id", campaignId)
        .single()

      if (campaignError || !campaign) {
        console.error("[players/gold] Campaign fetch error:", campaignError)
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
      }

      if (campaign.dm_user_id !== userId) {
        console.log("[players/gold] Access denied - not campaign owner")
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      // Get all campaign members with their gold
      const { data: members, error: membersError } = await supabase
        .from("campaign_members")
        .select(`
          user_id,
          role,
          joined_at,
          users!inner(
            id,
            clerk_user_id,
            username,
            email
          )
        `)
        .eq("campaign_id", campaignId)

      if (membersError) {
        console.error("[players/gold] Members fetch error:", membersError)
        return NextResponse.json({ error: "Failed to fetch campaign members" }, { status: 500 })
      }

      console.log("[players/gold] Campaign members:", members?.length || 0)

      // Get gold data for all members
      const { data: goldData, error: goldError } = await supabase
        .from("players_gold")
        .select("*")
        .eq("campaign_id", campaignId)

      if (goldError) {
        console.error("[players/gold] Gold fetch error:", goldError)
        return NextResponse.json({ error: "Failed to fetch gold data" }, { status: 500 })
      }

      // Combine member data with gold data
      const playersWithGold = (members || []).map((member) => {
        const goldRecord = goldData?.find((g) => g.player_id === member.user_id)
        return {
          player_id: member.user_id,
          player_clerk_id: member.users.clerk_user_id,
          player_name: member.users.username || member.users.email,
          gold_amount: goldRecord?.gold_amount || 0,
          role: member.role,
          joined_at: member.joined_at,
        }
      })

      console.log("[players/gold] Players with gold:", playersWithGold.length)

      return NextResponse.json({
        rows: playersWithGold,
      })
    }
  } catch (error) {
    console.error("[players/gold] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, campaignId, goldAmount } = await request.json()

    console.log("[players/gold] POST request:", { userId, playerId, campaignId, goldAmount })

    if (!playerId || !campaignId || typeof goldAmount !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createClient()

    // Verify user is the campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("dm_user_id")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.error("[players/gold] Campaign fetch error:", campaignError)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.dm_user_id !== userId) {
      console.log("[players/gold] Access denied - not campaign owner")
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verify player is a campaign member
    const { data: membership, error: membershipError } = await supabase
      .from("campaign_members")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", playerId)
      .single()

    if (membershipError || !membership) {
      console.log("[players/gold] Player not a campaign member:", { playerId, campaignId })
      return NextResponse.json({ error: "Player not found in campaign" }, { status: 404 })
    }

    // Upsert the gold record
    const { data, error } = await supabase
      .from("players_gold")
      .upsert(
        {
          player_id: playerId,
          campaign_id: campaignId,
          gold_amount: goldAmount,
        },
        {
          onConflict: "player_id,campaign_id",
        },
      )
      .select()

    if (error) {
      console.error("[players/gold] Upsert error:", error)
      return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
    }

    console.log("[players/gold] Gold updated successfully:", data)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[players/gold] POST unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

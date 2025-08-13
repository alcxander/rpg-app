import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabaseAdmin"

// GET /api/players/gold?campaignId=...&playerId=...
// If playerId is provided: return that player's gold (for player view)
// If no playerId: return all players' gold (DM-only view)
export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get("campaignId")
  const playerId = req.nextUrl.searchParams.get("playerId")

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createServerSupabaseClient(token)
  const adminSupabase = createAdminClient()

  console.log("[api/players/gold] GET start:", {
    campaignId,
    playerId,
    userId: userId.substring(0, 12) + "...",
    isPlayerView: !!playerId,
  })

  // Player view: get specific player's gold
  if (playerId) {
    console.log("[api/players/gold] Player view - fetching gold for:", playerId.substring(0, 12) + "...")

    // Verify the requesting user is either the player themselves or the campaign owner
    if (playerId !== userId) {
      // Check if requesting user is the campaign owner
      const { data: camp, error: cErr } = await supabase
        .from("campaigns")
        .select("owner_id")
        .eq("id", campaignId)
        .single()

      if (cErr || !camp || camp.owner_id !== userId) {
        console.error("[api/players/gold] Access denied - not player or owner:", {
          playerId,
          userId,
          campaignOwner: camp?.owner_id,
        })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Verify the player is a member of the campaign
    const { data: membership, error: memberErr } = await adminSupabase
      .from("campaign_members")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", playerId)
      .single()

    if (memberErr || !membership) {
      console.error("[api/players/gold] Player not a member:", { playerId, campaignId, error: memberErr })
      return NextResponse.json({ error: "Player is not a member of this campaign" }, { status: 400 })
    }

    // Get the player's gold record using admin client
    const { data: goldData, error: goldError } = await adminSupabase
      .from("players_gold")
      .select("player_id, gold_amount")
      .eq("campaign_id", campaignId)
      .eq("player_id", playerId)
      .maybeSingle()

    if (goldError) {
      console.error("[api/players/gold] Failed to load player gold:", goldError)
      return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })
    }

    const result = goldData ? [goldData] : [{ player_id: playerId, gold_amount: 0 }]
    console.log("[api/players/gold] Player gold result:", result)

    return NextResponse.json({ rows: result })
  }

  // DM view: get all players' gold
  console.log("[api/players/gold] DM view - fetching all players gold")

  // Verify DM ownership
  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) {
    console.error("[api/players/gold] Campaign not found:", cErr)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  if (camp.owner_id !== userId) {
    console.error("[api/players/gold] Access denied - not owner:", { userId, ownerId: camp.owner_id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  console.log("[api/players/gold] DM access verified for campaign:", campaignId)

  // Use admin client to get all campaign members (bypasses RLS)
  const { data: members, error: membersError } = await adminSupabase
    .from("campaign_members")
    .select(`
      user_id,
      role,
      joined_at
    `)
    .eq("campaign_id", campaignId)

  if (membersError) {
    console.error("[api/players/gold] Failed to fetch members:", membersError)
    return NextResponse.json({ error: "Failed to load campaign members" }, { status: 500 })
  }

  console.log("[api/players/gold] Found members:", members?.length || 0)

  if (!members || members.length === 0) {
    console.log("[api/players/gold] No members found for campaign")
    return NextResponse.json({ rows: [] })
  }

  // Get user info from users table using admin client
  const memberIds = members.map((m) => m.user_id)
  const { data: users, error: usersError } = await adminSupabase
    .from("users")
    .select("id, name, clerk_id")
    .in("clerk_id", memberIds)

  if (usersError) {
    console.error("[api/players/gold] Failed to fetch user info:", usersError)
    return NextResponse.json({ error: "Failed to load user information" }, { status: 500 })
  }

  console.log("[api/players/gold] Found users:", users?.length || 0)

  // Get existing gold records for all members
  const { data: goldRecords, error: goldError } = await adminSupabase
    .from("players_gold")
    .select("player_id, gold_amount")
    .eq("campaign_id", campaignId)
    .in("player_id", memberIds)

  if (goldError) {
    console.error("[api/players/gold] Failed to fetch gold records:", goldError)
    return NextResponse.json({ error: "Failed to load gold records" }, { status: 500 })
  }

  console.log("[api/players/gold] Found gold records:", goldRecords?.length || 0)

  // Create a map of existing gold amounts
  const goldMap = new Map()
  goldRecords?.forEach((record) => {
    goldMap.set(record.player_id, record.gold_amount)
  })

  // Create a map of user info by clerk_id
  const userMap = new Map()
  users?.forEach((user) => {
    userMap.set(user.clerk_id, user)
  })

  // Combine member info with gold amounts (default to 0 if no record)
  const result = members.map((member) => {
    const userInfo = userMap.get(member.user_id)
    return {
      player_id: member.user_id,
      gold_amount: goldMap.get(member.user_id) || 0,
      player_name: userInfo?.name || "Unknown User",
      player_clerk_id: member.user_id,
      role: member.role,
      joined_at: member.joined_at,
    }
  })

  console.log("[api/players/gold] DM gold query result:", {
    campaignId,
    membersCount: members.length,
    usersCount: users?.length || 0,
    goldRecordsCount: goldRecords?.length || 0,
    resultCount: result.length,
  })

  return NextResponse.json({ rows: result })
}

// POST /api/players/gold
// DM-only upsert of a player's gold row
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId, campaignId, goldAmount } = await req.json().catch(() => ({}))
  if (!playerId || !campaignId || typeof goldAmount !== "number") {
    return NextResponse.json({ error: "playerId, campaignId, goldAmount required" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient(token)
  const adminSupabase = createAdminClient()

  console.log("[api/players/gold] POST start:", {
    playerId: playerId.substring(0, 12) + "...",
    campaignId,
    goldAmount,
    userId: userId.substring(0, 12) + "...",
  })

  // Verify DM ownership
  const { data: camp, error: cErr } = await supabase.from("campaigns").select("owner_id").eq("id", campaignId).single()
  if (cErr || !camp) {
    console.error("[api/players/gold] Campaign not found:", cErr)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }
  if (camp.owner_id !== userId) {
    console.error("[api/players/gold] Access denied - not owner")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Verify the player is a member of the campaign using admin client
  const { data: membership, error: memberErr } = await adminSupabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", playerId)
    .single()

  if (memberErr || !membership) {
    console.error("[api/players/gold] Player not a member:", memberErr)
    return NextResponse.json({ error: "Player is not a member of this campaign" }, { status: 400 })
  }

  // Upsert player's gold using admin client
  const safeGold = Math.max(0, Math.round(Number(goldAmount) * 100) / 100)

  const { data: existing } = await adminSupabase
    .from("players_gold")
    .select("id")
    .eq("player_id", playerId)
    .eq("campaign_id", campaignId)
    .maybeSingle()

  const row = {
    player_id: playerId,
    campaign_id: campaignId,
    gold_amount: safeGold,
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = existing?.id
    ? await adminSupabase.from("players_gold").update(row).eq("id", existing.id)
    : await adminSupabase.from("players_gold").insert(row)

  if (upErr) {
    console.error("[api/players/gold] Failed to update gold:", upErr)
    return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
  }

  console.log("[api/players/gold] Gold updated successfully:", {
    playerId: playerId.substring(0, 12) + "...",
    campaignId,
    goldAmount: safeGold,
    wasUpdate: !!existing?.id,
  })

  return NextResponse.json({ ok: true })
}

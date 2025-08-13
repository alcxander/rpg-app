import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerSupabaseClient } from "@/lib/supabaseAdmin"

// GET /api/players/gold?campaignId=...
// DM-only read of all player gold for the campaign
export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get("campaignId")
  const playerId = req.nextUrl.searchParams.get("playerId")

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createServerSupabaseClient(token)

  // If playerId is provided, return just that player's gold (for non-DMs)
  if (playerId) {
    const { data, error } = await supabase
      .from("players_gold")
      .select("player_id, gold_amount")
      .eq("campaign_id", campaignId)
      .eq("player_id", playerId)

    if (error) return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })
    return NextResponse.json({ rows: data || [] })
  }

  // For DMs, verify ownership and return all campaign members with their gold
  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Get all campaign members with their user info
  const { data: members, error: membersError } = await supabase
    .from("campaign_members")
    .select(`
      user_id,
      users!inner(
        id,
        name,
        clerk_id
      )
    `)
    .eq("campaign_id", campaignId)

  if (membersError) {
    console.error("[api/players/gold] Failed to fetch members:", membersError)
    return NextResponse.json({ error: "Failed to load campaign members" }, { status: 500 })
  }

  // Get existing gold records for all members
  const memberIds = members?.map((m) => m.user_id) || []
  const { data: goldRecords, error: goldError } = await supabase
    .from("players_gold")
    .select("player_id, gold_amount")
    .eq("campaign_id", campaignId)
    .in("player_id", memberIds)

  if (goldError) {
    console.error("[api/players/gold] Failed to fetch gold records:", goldError)
    return NextResponse.json({ error: "Failed to load gold records" }, { status: 500 })
  }

  // Create a map of existing gold amounts
  const goldMap = new Map()
  goldRecords?.forEach((record) => {
    goldMap.set(record.player_id, record.gold_amount)
  })

  // Combine member info with gold amounts (default to 0 if no record)
  const result =
    members?.map((member) => ({
      player_id: member.user_id,
      gold_amount: goldMap.get(member.user_id) || 0,
      player_name: member.users.name,
      player_clerk_id: member.users.clerk_id,
    })) || []

  console.log("[api/players/gold] DM gold query result:", {
    campaignId,
    membersCount: members?.length || 0,
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

  // Verify DM ownership
  const { data: camp, error: cErr } = await supabase.from("campaigns").select("owner_id").eq("id", campaignId).single()
  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Verify the player is a member of the campaign
  const { data: membership, error: memberErr } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", playerId)
    .single()

  if (memberErr || !membership) {
    return NextResponse.json({ error: "Player is not a member of this campaign" }, { status: 400 })
  }

  // Upsert player's gold
  const safeGold = Math.max(0, Math.round(Number(goldAmount) * 100) / 100)

  const { data: existing } = await supabase
    .from("players_gold")
    .select("id")
    .eq("player_id", playerId)
    .eq("campaign_id", campaignId)
    .maybeSingle()

  const row = {
    id: existing?.id,
    player_id: playerId,
    campaign_id: campaignId,
    gold_amount: safeGold,
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = existing?.id
    ? await supabase.from("players_gold").update(row).eq("id", existing.id)
    : await supabase.from("players_gold").insert(row)

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

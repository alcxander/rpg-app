import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerSupabaseClient } from "@/lib/supabaseAdmin"

// GET /api/players/gold?campaignId=...&playerId=...
// DM/Owner can read all player gold for campaign, or specific player gold
export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId || !getToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = await getToken({ template: "supabase" })
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get("campaignId")
  const playerId = req.nextUrl.searchParams.get("playerId")

  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createServerSupabaseClient(token)

  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  // Check if user is owner or DM
  let hasDMPrivileges = false
  let accessReason = ""

  if (camp.owner_id === userId) {
    hasDMPrivileges = true
    accessReason = "campaign owner"
  } else {
    // Check if user is a DM in this campaign
    const { data: membership, error: memberError } = await supabase
      .from("campaign_members")
      .select("role")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    if (membership && membership.role === "DM") {
      hasDMPrivileges = true
      accessReason = "campaign DM"
    } else if (memberError && memberError.code !== "PGRST116") {
      console.error("[api/players/gold] GET membership check error", { error: memberError })
    }
  }

  if (!hasDMPrivileges && playerId === userId) {
    const { data, error } = await supabase
      .from("players_gold")
      .select("player_id, gold_amount")
      .eq("campaign_id", campaignId)
      .eq("player_id", userId)

    if (error) return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })
    return NextResponse.json({ rows: data || [] })
  }

  if (!hasDMPrivileges) {
    return NextResponse.json({ error: "Forbidden - requires DM privileges" }, { status: 403 })
  }

  let query = supabase
    .from("players_gold")
    .select(`
      player_id, 
      gold_amount,
      users!players_gold_player_id_fkey (
        name,
        clerk_id
      )
    `)
    .eq("campaign_id", campaignId)

  if (playerId) {
    query = query.eq("player_id", playerId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })

  const formattedData = (data || []).map((row: any) => ({
    player_id: row.player_id,
    gold_amount: row.gold_amount,
    player_name: row.users?.name || null,
  }))

  return NextResponse.json({ rows: formattedData })
}

// POST /api/players/gold
// DM/Owner can upsert a player's gold row
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

  const { data: camp, error: cErr } = await supabase.from("campaigns").select("owner_id").eq("id", campaignId).single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  // Check if user is owner or DM
  let hasDMPrivileges = false

  if (camp.owner_id === userId) {
    hasDMPrivileges = true
  } else {
    // Check if user is a DM in this campaign
    const { data: membership, error: memberError } = await supabase
      .from("campaign_members")
      .select("role")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single()

    if (membership && membership.role === "DM") {
      hasDMPrivileges = true
    } else if (memberError && memberError.code !== "PGRST116") {
      console.error("[api/players/gold] POST membership check error", { error: memberError })
    }
  }

  if (!hasDMPrivileges) {
    return NextResponse.json({ error: "Forbidden - requires DM privileges" }, { status: 403 })
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

  if (upErr) return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

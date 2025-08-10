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
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createServerSupabaseClient(token)

  // Verify DM ownership using the original owner_id field
  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("players_gold")
    .select("player_id, gold_amount")
    .eq("campaign_id", campaignId)

  if (error) return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })

  return NextResponse.json({ rows: data || [] })
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

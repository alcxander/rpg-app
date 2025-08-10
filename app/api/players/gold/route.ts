import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const campaignId = req.nextUrl.searchParams.get("campaignId")
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createClient()
  // Only DM can view all gold rows
  const { data: camp, error: cErr } = await supabase.from("campaigns").select("dm_id").eq("id", campaignId).single()
  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.dm_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("players_gold")
    .select("player_id, gold_amount")
    .eq("campaign_id", campaignId)
  if (error) return NextResponse.json({ error: "Failed to load gold" }, { status: 500 })

  return NextResponse.json({ rows: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId, campaignId, goldAmount } = await req.json()
  if (!playerId || !campaignId) return NextResponse.json({ error: "playerId and campaignId required" }, { status: 400 })

  const supabase = createClient()

  // DM guard
  const { data: camp, error: cErr } = await supabase.from("campaigns").select("dm_id").eq("id", campaignId).single()
  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (camp.dm_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: row } = await supabase
    .from("players_gold")
    .select("id")
    .eq("player_id", playerId)
    .eq("campaign_id", campaignId)
    .single()

  const { error: upErr } = await supabase.from("players_gold").upsert({
    id: row?.id,
    player_id: playerId,
    campaign_id: campaignId,
    gold_amount: Number(goldAmount ?? 0),
    updated_at: new Date().toISOString(),
  })

  if (upErr) return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { playerId, campaignId, goldAmount } = await req.json().catch(() => ({}))
  if (!playerId || !campaignId || typeof goldAmount !== "number") {
    return NextResponse.json({ error: "playerId, campaignId, goldAmount required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data: camp } = await supabase.from("campaigns").select("id, owner_id").eq("id", campaignId).single()
  if (!camp || camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: existing } = await supabase
    .from("players_gold")
    .select("id")
    .eq("player_id", playerId)
    .eq("campaign_id", campaignId)
    .maybeSingle()

  const upsert = {
    player_id: playerId,
    campaign_id: campaignId,
    gold_amount: Math.max(0, Math.round(goldAmount * 100) / 100),
    updated_at: new Date().toISOString(),
    id: existing?.id,
  }

  const { error } = existing?.id
    ? await supabase.from("players_gold").update(upsert).eq("id", existing.id)
    : await supabase.from("players_gold").insert(upsert)

  if (error) return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

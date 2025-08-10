import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { inventoryId, quantity, sessionId } = await req.json()
    const qty = Math.max(1, Math.floor(Number(quantity || 1)))
    const supabase = createClient()

    // Load inventory + shopkeeper
    const { data: inv, error: iErr } = await supabase
      .from("shop_inventory")
      .select("id, shopkeeper_id, item_name, final_price, stock_quantity, shopkeepers!inner(campaign_id)")
      .eq("id", inventoryId)
      .single()

    if (iErr || !inv) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    const campaignId = (inv as any).shopkeepers.campaign_id as string

    // Load campaign
    const { data: camp, error: cErr } = await supabase
      .from("campaigns")
      .select("id, dm_id, access_enabled")
      .eq("id", campaignId)
      .single()
    if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const isDM = camp.dm_id === userId
    if (!isDM && !camp.access_enabled) {
      return NextResponse.json({ error: "Shop access disabled by DM" }, { status: 403 })
    }

    if (inv.stock_quantity < qty) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 })
    }

    const priceEach = Number(inv.final_price)
    const total = priceEach * qty

    // If player (not DM), verify and deduct gold
    if (!isDM) {
      const { data: goldRow } = await supabase
        .from("players_gold")
        .select("id, gold_amount")
        .eq("player_id", userId)
        .eq("campaign_id", campaignId)
        .single()

      const current = Number(goldRow?.gold_amount ?? 0)
      if (current < total) {
        return NextResponse.json({ error: "Not enough gold" }, { status: 400 })
      }

      const { error: gErr } = await supabase.from("players_gold").upsert({
        id: goldRow?.id,
        player_id: userId,
        campaign_id: campaignId,
        gold_amount: current - total,
        updated_at: new Date().toISOString(),
      })
      if (gErr) return NextResponse.json({ error: "Failed to deduct gold" }, { status: 500 })
    }

    // Update stock
    const { error: uErr } = await supabase
      .from("shop_inventory")
      .update({ stock_quantity: inv.stock_quantity - qty })
      .eq("id", inventoryId)
    if (uErr) return NextResponse.json({ error: "Failed to update stock" }, { status: 500 })

    // Record transaction
    const { error: tErr } = await supabase.from("shop_transactions").insert({
      shopkeeper_id: inv.shopkeeper_id,
      player_id: userId,
      item_name: inv.item_name,
      quantity: qty,
      price_each: priceEach,
      total_price: total,
      transaction_type: "purchase",
    })
    if (tErr) {
      // non-fatal
      console.error("shop_transactions insert failed", tErr)
    }

    // Activity log (best-effort; ignore errors)
    if (sessionId) {
      try {
        await supabase.from("messages").insert({
          session_id: sessionId,
          content: `🛍️ [SHOP] ${qty}x ${inv.item_name} purchased for ${total} gp`,
          role: "system",
          created_at: new Date().toISOString(),
        })
      } catch (e) {
        // ignore
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { inventoryId, quantity, sessionId } = await req.json()
    const qty = Math.max(1, Math.floor(Number(quantity || 1)))
    const supabase = createAdminClient()

    console.log("[purchase] Request:", { inventoryId, quantity: qty, userId, sessionId })

    // Load inventory + shopkeeper
    const { data: inv, error: iErr } = await supabase
      .from("shop_inventory")
      .select("id, shopkeeper_id, item_name, final_price, stock_quantity, shopkeepers!inner(campaign_id)")
      .eq("id", inventoryId)
      .single()

    if (iErr || !inv) {
      console.error("[purchase] Item not found:", iErr)
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const campaignId = (inv as any).shopkeepers.campaign_id as string
    console.log("[purchase] Found item:", {
      itemName: inv.item_name,
      price: inv.final_price,
      stock: inv.stock_quantity,
      campaignId,
    })

    // Load campaign
    const { data: camp, error: cErr } = await supabase
      .from("campaigns")
      .select("id, owner_id, access_enabled")
      .eq("id", campaignId)
      .single()

    if (cErr || !camp) {
      console.error("[purchase] Campaign not found:", cErr)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = camp.owner_id === userId
    console.log("[purchase] Access check:", { isOwner, accessEnabled: camp.access_enabled })

    if (!isOwner && !camp.access_enabled) {
      return NextResponse.json({ error: "Shop access disabled by DM" }, { status: 403 })
    }

    if (inv.stock_quantity < qty) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 })
    }

    const priceEach = Number(inv.final_price)
    const total = priceEach * qty

    console.log("[purchase] Price calculation:", { priceEach, qty, total })

    // If player (not owner), verify and deduct gold
    if (!isOwner) {
      const { data: goldRow, error: goldFetchError } = await supabase
        .from("players_gold")
        .select("id, gold_amount")
        .eq("player_id", userId)
        .eq("campaign_id", campaignId)
        .single()

      if (goldFetchError && goldFetchError.code !== "PGRST116") {
        console.error("[purchase] Error fetching gold:", goldFetchError)
        return NextResponse.json({ error: "Failed to fetch gold" }, { status: 500 })
      }

      const current = Number(goldRow?.gold_amount ?? 0)
      console.log("[purchase] Player gold check:", { current, required: total, hasEnough: current >= total })

      if (current < total) {
        return NextResponse.json({ error: "Not enough gold" }, { status: 400 })
      }

      // Deduct gold
      const { error: gErr } = await supabase.from("players_gold").upsert({
        id: goldRow?.id,
        player_id: userId,
        campaign_id: campaignId,
        gold_amount: current - total,
        updated_at: new Date().toISOString(),
      })

      if (gErr) {
        console.error("[purchase] Failed to deduct gold:", gErr)
        return NextResponse.json({ error: "Failed to deduct gold" }, { status: 500 })
      }

      console.log("[purchase] Gold deducted:", { from: current, to: current - total })
    }

    // Update stock
    const { error: uErr } = await supabase
      .from("shop_inventory")
      .update({ stock_quantity: inv.stock_quantity - qty })
      .eq("id", inventoryId)

    if (uErr) {
      console.error("[purchase] Failed to update stock:", uErr)
      return NextResponse.json({ error: "Failed to update stock" }, { status: 500 })
    }

    console.log("[purchase] Stock updated:", { from: inv.stock_quantity, to: inv.stock_quantity - qty })

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
        console.error("[purchase] Activity log failed:", e)
      }
    }

    console.log("[purchase] Purchase completed successfully")
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[purchase] Unexpected error:", e)
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

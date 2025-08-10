import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient()
  const { inventoryId, quantity = 1, sessionId = null } = await req.json()

  if (!inventoryId || quantity <= 0) {
    return NextResponse.json({ error: "inventoryId and positive quantity required" }, { status: 400 })
  }

  // Load inventory and related shopkeeper + campaign
  const { data: inv, error: iErr } = await supabase
    .from("shop_inventory")
    .select("id, item_name, final_price, stock_quantity, shopkeeper_id")
    .eq("id", inventoryId)
    .single()
  if (iErr || !inv) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  const { data: shop, error: sErr } = await supabase
    .from("shopkeepers")
    .select("id, name, campaign_id")
    .eq("id", inv.shopkeeper_id)
    .single()
  if (sErr || !shop) return NextResponse.json({ error: "Shopkeeper not found" }, { status: 404 })

  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id, access_enabled")
    .eq("id", shop.campaign_id)
    .single()
  if (cErr || !campaign) return NextResponse.json({ error: "Campaign missing" }, { status: 404 })

  const isDM = campaign.owner_id === userId
  if (!isDM && !campaign.access_enabled) {
    return NextResponse.json({ error: "Shop access disabled by DM" }, { status: 403 })
  }

  // Validate stock
  if (inv.stock_quantity < quantity) {
    return NextResponse.json({ error: "Not enough stock" }, { status: 400 })
  }

  const total = Number(inv.final_price) * Number(quantity)

  // Player gold check/deduct unless DM
  if (!isDM) {
    // upsert players_gold row if needed
    const { data: pg } = await supabase
      .from("players_gold")
      .select("id, gold_amount")
      .eq("player_id", userId)
      .eq("campaign_id", campaign.id)
      .maybeSingle()

    const currentGold = Number(pg?.gold_amount ?? 0)
    if (currentGold < total) {
      return NextResponse.json({ error: "Insufficient gold" }, { status: 400 })
    }
    const newGold = Math.round((currentGold - total) * 100) / 100

    const upsert = {
      player_id: userId,
      campaign_id: campaign.id,
      gold_amount: newGold,
      updated_at: new Date().toISOString(),
      id: pg?.id,
    }
    const { error: gErr } = pg?.id
      ? await supabase.from("players_gold").update(upsert).eq("id", pg.id)
      : await supabase.from("players_gold").insert(upsert)
    if (gErr) return NextResponse.json({ error: "Failed to update gold" }, { status: 500 })
  }

  // Update stock
  const newQty = inv.stock_quantity - quantity
  const { error: uErr } = await supabase.from("shop_inventory").update({ stock_quantity: newQty }).eq("id", inv.id)
  if (uErr) return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 })

  // Record transaction
  const { error: tErr } = await supabase.from("shop_transactions").insert({
    shopkeeper_id: shop.id,
    player_id: userId,
    item_name: inv.item_name,
    quantity,
    price_each: inv.final_price,
    total_price: total,
    transaction_type: "purchase",
  })
  if (tErr) console.error("transaction insert failed", tErr)

  // Activity message (if sessionId provided)
  if (sessionId) {
    const content = `🛍️ [SHOP] Purchase: ${quantity} x ${inv.item_name} from ${shop.name} for ${total} gp.`
    try {
      await supabase.from("messages").insert({
        session_id: sessionId,
        campaign_id: campaign.id,
        user_id: userId,
        content,
      })
    } catch (e) {
      console.warn("Failed to insert activity message:", e)
    }
  }

  return NextResponse.json({ ok: true, remaining_stock: newQty })
}

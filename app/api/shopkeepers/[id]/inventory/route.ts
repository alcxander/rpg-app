import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopkeeperId = params.id
  const body = await req.json().catch(() => ({}))

  const supabase = createClient()
  const { data: shop } = await supabase.from("shopkeepers").select("id, campaign_id").eq("id", shopkeeperId).single()
  if (!shop) return NextResponse.json({ error: "Shopkeeper not found" }, { status: 404 })
  const { data: camp } = await supabase.from("campaigns").select("id, owner_id").eq("id", shop.campaign_id).single()
  if (!camp || camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Update existing inventory row
  const invId = body?.id
  if (!invId) return NextResponse.json({ error: "Inventory id required" }, { status: 400 })

  const updates: any = {}
  if (typeof body.stock_quantity === "number") updates.stock_quantity = body.stock_quantity
  if (typeof body.final_price === "number") updates.final_price = body.final_price

  const { error } = await supabase
    .from("shop_inventory")
    .update(updates)
    .eq("id", invId)
    .eq("shopkeeper_id", shopkeeperId)
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Add a new item
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopkeeperId = params.id
  const body = await req.json().catch(() => ({}))

  const supabase = createClient()
  const { data: shop } = await supabase.from("shopkeepers").select("id, campaign_id").eq("id", shopkeeperId).single()
  if (!shop) return NextResponse.json({ error: "Shopkeeper not found" }, { status: 404 })
  const { data: camp } = await supabase.from("campaigns").select("id, owner_id").eq("id", shop.campaign_id).single()
  if (!camp || camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { item_name, rarity, base_price, price_adjustment_percent = 0, final_price, stock_quantity = 1 } = body
  if (!item_name || !rarity || typeof base_price !== "number" || typeof final_price !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const { error } = await supabase.from("shop_inventory").insert({
    shopkeeper_id: shopkeeperId,
    item_name,
    rarity,
    base_price,
    price_adjustment_percent,
    final_price,
    stock_quantity,
  })
  if (error) return NextResponse.json({ error: "Failed to add item" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

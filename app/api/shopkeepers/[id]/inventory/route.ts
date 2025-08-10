import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

async function assertDM(supabase: ReturnType<typeof createClient>, userId: string, shopkeeperId: string) {
  const { data: shop, error: sErr } = await supabase
    .from("shopkeepers")
    .select("id, campaign_id")
    .eq("id", shopkeeperId)
    .single()
  if (sErr || !shop) return { ok: false as const, status: 404, error: "Shopkeeper not found" }

  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("dm_id")
    .eq("id", shop.campaign_id)
    .single()
  if (cErr || !camp) return { ok: false as const, status: 404, error: "Campaign not found" }
  if (camp.dm_id !== userId) return { ok: false as const, status: 403, error: "Forbidden" }
  return { ok: true as const, shop }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createClient()

  const check = await assertDM(supabase, userId, params.id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json()
  const { id, stock_quantity, final_price } = body as { id: string; stock_quantity?: number; final_price?: number }
  if (!id) return NextResponse.json({ error: "inventory id required" }, { status: 400 })

  const update: any = {}
  if (typeof stock_quantity === "number") update.stock_quantity = Math.max(0, Math.floor(stock_quantity))
  if (typeof final_price === "number") update.final_price = Math.max(0, Number(final_price))

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 })

  const { data, error } = await supabase
    .from("shop_inventory")
    .update(update)
    .eq("id", id)
    .eq("shopkeeper_id", params.id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createClient()

  const check = await assertDM(supabase, userId, params.id)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json()
  const payload = {
    shopkeeper_id: params.id,
    item_name: String(body.item_name || "").trim(),
    rarity: body.rarity || "common",
    base_price: Number(body.base_price ?? 0),
    price_adjustment_percent: Number(body.price_adjustment_percent ?? 0),
    final_price: Number(body.final_price ?? body.base_price ?? 0),
    stock_quantity: Math.max(0, Math.floor(Number(body.stock_quantity ?? 0))),
  }

  if (!payload.item_name) return NextResponse.json({ error: "item_name required" }, { status: 400 })

  const { data, error } = await supabase.from("shop_inventory").insert(payload).select("*").single()
  if (error) return NextResponse.json({ error: "Failed to add item" }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

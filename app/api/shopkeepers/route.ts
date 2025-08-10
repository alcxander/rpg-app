import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get("campaignId")
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  const supabase = createClient()

  // Fetch campaign
  const { data: camp, error: cErr } = await supabase
    .from("campaigns")
    .select("id, name, dm_id, access_enabled")
    .eq("id", campaignId)
    .single()

  if (cErr || !camp) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  const isOwner = camp.dm_id === userId

  // Access: DM always, otherwise only if access_enabled
  if (!isOwner && !camp.access_enabled) {
    return NextResponse.json({ error: "Access disabled by DM" }, { status: 403 })
  }

  // Load shopkeepers
  const { data: shops, error: sErr } = await supabase
    .from("shopkeepers")
    .select("id, name, race, age, alignment, quote, description, shop_type, token_id, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })

  if (sErr) return NextResponse.json({ error: "Failed to load shopkeepers" }, { status: 500 })

  if (!shops || shops.length === 0) {
    return NextResponse.json({
      campaign: { id: camp.id, name: camp.name, access_enabled: camp.access_enabled, isOwner },
      shopkeepers: [],
    })
  }

  // Build token map
  const tokenIds = Array.from(new Set(shops.map((s) => s.token_id).filter(Boolean))) as string[]
  let tokenMap = new Map<string, string>()
  if (tokenIds.length) {
    const { data: tokens } = await supabase.from("tokens").select("id, image_url").in("id", tokenIds)
    if (tokens) {
      tokenMap = new Map(tokens.map((t: any) => [t.id, t.image_url]))
    }
  }

  // Load inventories
  const shopIds = shops.map((s) => s.id)
  const { data: inv, error: iErr } = await supabase
    .from("shop_inventory")
    .select("id, shopkeeper_id, item_name, rarity, base_price, price_adjustment_percent, final_price, stock_quantity")
    .in("shopkeeper_id", shopIds)
    .order("created_at", { ascending: true })

  if (iErr) return NextResponse.json({ error: "Failed to load inventory" }, { status: 500 })

  const byShop = new Map<string, any[]>()
  for (const row of inv || []) {
    const arr = byShop.get(row.shopkeeper_id) || []
    arr.push(row)
    byShop.set(row.shopkeeper_id, arr)
  }

  const result = shops.map((s) => ({
    ...s,
    image_url: s.token_id ? tokenMap.get(s.token_id) || null : null,
    inventory: byShop.get(s.id) || [],
  }))

  return NextResponse.json({
    campaign: { id: camp.id, name: camp.name, access_enabled: camp.access_enabled, isOwner },
    shopkeepers: result,
  })
}

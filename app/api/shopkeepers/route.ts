import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const campaignId = req.nextUrl.searchParams.get("campaignId")
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createClient()

    // Load campaign to determine permissions
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, access_enabled, dm_id")
      .eq("id", campaignId)
      .single()

    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const isOwner = campaign.dm_id === userId
    if (!isOwner && !campaign.access_enabled) {
      return NextResponse.json({ error: "Access disabled by DM" }, { status: 403 })
    }

    // Fetch shopkeepers for campaign
    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id, name, race, age, alignment, quote, description, shop_type, token_id, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })

    if (sErr) throw sErr

    if (!shops || shops.length === 0) {
      return NextResponse.json({
        campaign: { access_enabled: campaign.access_enabled, isOwner },
        shopkeepers: [],
      })
    }

    const shopIds = shops.map((s) => s.id)
    const tokenIds = shops.map((s) => s.token_id).filter(Boolean)

    // Load inventory
    const { data: inv, error: iErr } = await supabase
      .from("shop_inventory")
      .select("id, shopkeeper_id, item_name, rarity, base_price, price_adjustment_percent, final_price, stock_quantity")
      .in("shopkeeper_id", shopIds)

    if (iErr) throw iErr

    // Load tokens for image_url
    const tokenMap = new Map<string, string>()
    if (tokenIds.length > 0) {
      const { data: tokens, error: tErr } = await supabase
        .from("tokens")
        .select("id, image_url")
        .in("id", tokenIds as string[])
      if (tErr) throw tErr
      for (const t of tokens || []) tokenMap.set(t.id, t.image_url)
    }

    const invByShop = new Map<string, any[]>()
    for (const row of inv || []) {
      const arr = invByShop.get(row.shopkeeper_id) || []
      arr.push({
        id: row.id,
        item_name: row.item_name,
        rarity: row.rarity,
        base_price: Number(row.base_price),
        price_adjustment_percent: row.price_adjustment_percent,
        final_price: Number(row.final_price),
        stock_quantity: row.stock_quantity,
      })
      invByShop.set(row.shopkeeper_id, arr)
    }

    const output = shops.map((s) => ({
      id: s.id,
      name: s.name,
      race: s.race,
      age: s.age,
      alignment: s.alignment,
      quote: s.quote,
      description: s.description,
      shop_type: s.shop_type,
      created_at: s.created_at,
      image_url: s.token_id ? tokenMap.get(s.token_id) || null : null,
      inventory: invByShop.get(s.id) || [],
    }))

    return NextResponse.json({
      campaign: { access_enabled: campaign.access_enabled, isOwner },
      shopkeepers: output,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}

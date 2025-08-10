import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest) {
  const t0 = Date.now()
  const { userId } = auth()
  const reqId = Math.random().toString(36).slice(2, 8)
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || ""

  console.log("[api/shopkeepers] GET start", { reqId, userId, campaignId })

  if (!userId) {
    console.warn("[api/shopkeepers] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!campaignId) {
    console.warn("[api/shopkeepers] missing campaignId", { reqId })
    return NextResponse.json({ error: "campaignId required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // Load campaign to check DM and access
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,dm_id,access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[api/shopkeepers] campaign fetch", { reqId, cErr, hasCampaign: !!campaign })

    if (cErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.dm_id === userId
    if (!isOwner && !campaign.access_enabled) {
      console.warn("[api/shopkeepers] forbidden for non-DM (access disabled)", { reqId })
      return NextResponse.json({ error: "Access disabled" }, { status: 403 })
    }

    // Fetch shopkeepers in campaign
    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,token_id,created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
    console.log("[api/shopkeepers] shops fetch", { reqId, count: shops?.length ?? 0, sErr })

    const shopkeepers = shops || []
    const ids = shopkeepers.map((s) => s.id)
    const tokenIds = Array.from(new Set(shopkeepers.map((s) => s.token_id).filter(Boolean)))

    // Fetch inventory rows
    let inventoryRows: any[] = []
    if (ids.length) {
      const { data: inv, error: iErr } = await supabase
        .from("shop_inventory")
        .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
        .in("shopkeeper_id", ids)
      console.log("[api/shopkeepers] inventory fetch", { reqId, count: inv?.length ?? 0, iErr })
      inventoryRows = inv || []
    }

    // Fetch tokens
    const tokenMap = new Map<string, string>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase.from("tokens").select("id,image_url").in("id", tokenIds)
      console.log("[api/shopkeepers] tokens fetch", { reqId, count: tokens?.length ?? 0, tErr })
      if (tokens) {
        for (const t of tokens) tokenMap.set(t.id, t.image_url)
      }
    }

    // Compose results
    const invByShop = new Map<string, any[]>()
    for (const row of inventoryRows) {
      const arr = invByShop.get(row.shopkeeper_id) || []
      arr.push(row)
      invByShop.set(row.shopkeeper_id, arr)
    }

    const result = shopkeepers.map((s) => ({
      id: s.id,
      name: s.name,
      race: s.race,
      age: s.age,
      alignment: s.alignment,
      quote: s.quote,
      description: s.description,
      shop_type: s.shop_type,
      image_url: s.token_id ? tokenMap.get(s.token_id) || null : null,
      inventory: invByShop.get(s.id) || [],
      created_at: s.created_at,
    }))

    console.log("[api/shopkeepers] done", {
      reqId,
      shops: result.length,
      ms: Date.now() - t0,
      isOwner,
      access_enabled: campaign.access_enabled,
    })
    return NextResponse.json({
      shopkeepers: result,
      campaign: { id: campaign.id, access_enabled: campaign.access_enabled, isOwner },
    })
  } catch (e: any) {
    console.error("[api/shopkeepers] exception", { reqId, message: e?.message, stack: e?.stack })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

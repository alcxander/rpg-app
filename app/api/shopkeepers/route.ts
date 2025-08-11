import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function GET(req: NextRequest) {
  const reqId = rid()
  const url = new URL(req.url)
  const campaignId = url.searchParams.get("campaignId") || ""
  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/shopkeepers] GET start", {
      reqId,
      userId: !!userId,
      sessionId,
      campaignId,
    })
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Fetch campaign and verify access
    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("id,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    if (campErr || !camp) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = userId && camp.owner_id === userId
    if (!isOwner && !camp.access_enabled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get active shopkeepers (removed=false or null)
    const { data: shops, error: shopsErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,image_url,created_at")
      .eq("campaign_id", campaignId)
      .or("removed.is.null,removed.eq.false")
      .order("created_at", { ascending: false })

    if (shopsErr) {
      console.error("[api/shopkeepers] shops error", { reqId, error: shopsErr.message })
      return NextResponse.json({ error: shopsErr.message }, { status: 500 })
    }

    const ids = (shops ?? []).map((s) => s.id)
    let inventoryByShop: Record<string, any[]> = {}
    if (ids.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("shopkeeper_inventory")
        .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
        .in("shopkeeper_id", ids)

      if (itemsErr) {
        console.error("[api/shopkeepers] inventory error", { reqId, error: itemsErr.message })
        return NextResponse.json({ error: itemsErr.message }, { status: 500 })
      }
      inventoryByShop = (items ?? []).reduce((acc: Record<string, any[]>, it: any) => {
        const sid = it.shopkeeper_id
        if (!acc[sid]) acc[sid] = []
        acc[sid].push({
          id: it.id,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        })
        return acc
      }, {})
    }

    const result = (shops ?? []).map((s) => ({
      ...s,
      inventory: inventoryByShop[s.id] ?? [],
    }))

    console.log("[api/shopkeepers] GET done", {
      reqId,
      campaignId,
      count: result.length,
      isOwner,
      access: camp.access_enabled,
    })
    return NextResponse.json({
      campaign: { id: campaignId, isOwner, access_enabled: camp.access_enabled },
      shopkeepers: result,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

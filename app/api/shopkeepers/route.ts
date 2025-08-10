import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

// GET /api/shopkeepers?campaignId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || undefined
  const { userId } = auth()
  const reqId = Math.random().toString(36).slice(2, 8)
  const t0 = Date.now()
  console.log("[api/shopkeepers] GET start", { reqId, userId, campaignId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  try {
    const supabase = createAdminClient()

    // campaign access: owner or dm, else require access_enabled
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,dm_id,access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[api/shopkeepers] campaign", {
      reqId,
      cErr: cErr?.message,
      owner_id: campaign?.owner_id,
      dm_id: campaign?.dm_id,
      access_enabled: campaign?.access_enabled,
    })
    if (!campaign || cErr) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const isOwner = campaign.owner_id === userId || campaign.dm_id === userId
    if (!isOwner && !campaign.access_enabled) {
      console.warn("[api/shopkeepers] access disabled for non-owner", { reqId })
      return NextResponse.json({ campaign: { ...campaign, isOwner }, shopkeepers: [] })
    }

    // Fetch shopkeepers
    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,token_id,created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
    console.log("[api/shopkeepers] shops", { reqId, count: shops?.length ?? 0, sErr: sErr?.message })

    const tokenIds = (shops || []).map((s) => s.token_id).filter(Boolean)
    let tokenMap = new Map<string, string>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase
        .from("tokens")
        .select("id,image_url")
        .in("id", tokenIds as string[])
      console.log("[api/shopkeepers] tokens", { reqId, count: tokens?.length ?? 0, tErr: tErr?.message })
      if (!tErr && tokens) tokenMap = new Map(tokens.map((t) => [t.id as unknown as string, t.image_url as string]))
    }

    const shopIds = (shops || []).map((s) => s.id)
    const invByShop = new Map<string, any[]>()
    if (shopIds.length) {
      const { data: invRows, error: iErr } = await supabase
        .from("shop_inventory")
        .select(
          "id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity,created_at",
        )
        .in("shopkeeper_id", shopIds as string[])
      console.log("[api/shopkeepers] inventory", { reqId, count: invRows?.length ?? 0, iErr: iErr?.message })
      if (!iErr && invRows) {
        for (const r of invRows) {
          const arr = invByShop.get(r.shopkeeper_id) || []
          arr.push(r)
          invByShop.set(r.shopkeeper_id, arr)
        }
      }
    }

    const result = (shops || []).map((s) => ({
      ...s,
      image_url: s.token_id ? tokenMap.get(s.token_id as unknown as string) || null : null,
      inventory: invByShop.get(s.id) || [],
    }))

    console.log("[api/shopkeepers] done", { reqId, shops: result.length, ms: Date.now() - t0 })
    return NextResponse.json({ campaign: { ...campaign, isOwner }, shopkeepers: result })
  } catch (e: any) {
    console.error("[api/shopkeepers] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

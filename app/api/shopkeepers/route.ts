import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

// GET /api/shopkeepers?campaignId=...
export async function GET(req: NextRequest) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || ""
  console.log("[api/shopkeepers] GET start", { reqId, hasUser: !!userId, sessionId, campaignId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  try {
    const supabase = createAdminClient()

    // Verify campaign and access rules
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[api/shopkeepers] campaign lookup", {
      reqId,
      error: cErr?.message || null,
      owner_id: campaign?.owner_id,
      access_enabled: campaign?.access_enabled,
    })
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const isOwner = campaign.owner_id === userId
    if (!isOwner && !campaign.access_enabled) {
      console.warn("[api/shopkeepers] access disabled for non-owner", { reqId })
      // Return empty list but with campaign meta so UI can reflect toggle state
      return NextResponse.json({ campaign: { ...campaign, isOwner }, shopkeepers: [] })
    }

    // Fetch shopkeepers for campaign
    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,token_id,created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
    console.log("[api/shopkeepers] shopkeepers fetch", {
      reqId,
      count: shops?.length ?? 0,
      error: sErr?.message || null,
    })

    const tokenIds = (shops || []).map((s) => s.token_id).filter(Boolean) as string[]
    let tokenMap = new Map<string, string>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase.from("tokens").select("id,image_url").in("id", tokenIds)
      console.log("[api/shopkeepers] tokens fetch", { reqId, count: tokens?.length ?? 0, error: tErr?.message || null })
      if (tokens) tokenMap = new Map(tokens.map((t) => [String(t.id), String(t.image_url)]))
    }

    const shopIds = (shops || []).map((s) => s.id)
    const invByShop = new Map<string, any[]>()
    if (shopIds.length) {
      const { data: invRows, error: iErr } = await supabase
        .from("shop_inventory")
        .select(
          "id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity,created_at",
        )
        .in("shopkeeper_id", shopIds)
      console.log("[api/shopkeepers] inventory fetch", {
        reqId,
        count: invRows?.length ?? 0,
        error: iErr?.message || null,
      })
      for (const row of invRows || []) {
        const arr = invByShop.get(row.shopkeeper_id) || []
        arr.push(row)
        invByShop.set(row.shopkeeper_id, arr)
      }
    }

    const result = (shops || []).map((s) => ({
      ...s,
      image_url: s.token_id ? tokenMap.get(String(s.token_id)) || null : null,
      inventory: invByShop.get(s.id) || [],
    }))

    console.log("[api/shopkeepers] GET done", {
      reqId,
      shops: result.length,
      isOwner,
      access_enabled: campaign.access_enabled,
    })
    return NextResponse.json({ campaign: { ...campaign, isOwner }, shopkeepers: result })
  } catch (e: any) {
    console.error("[api/shopkeepers] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

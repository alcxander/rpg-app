import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function GET(req: NextRequest) {
  const reqId = rid()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || ""
  const { userId, sessionId } = getAuth(req)
  console.log("[api/shopkeepers] GET start", { reqId, campaignId, hasUser: !!userId, sessionId })

  if (!userId) {
    console.log("[api/shopkeepers] GET unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Campaign access
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) {
      console.log("[api/shopkeepers] GET campaign not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    const isOwner = campaign.owner_id === userId
    if (!isOwner && !campaign.access_enabled) {
      console.log("[api/shopkeepers] GET forbidden - access disabled", { reqId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Active shopkeepers
    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,created_at,token_id,removed")
      .eq("campaign_id", campaignId)
      .eq("removed", false)
      .order("created_at", { ascending: false })

    if (sErr) {
      console.error("[api/shopkeepers] GET shops error", { reqId, message: sErr.message })
      return NextResponse.json({ error: "Failed to load shopkeepers" }, { status: 500 })
    }

    const shopIds = (shops || []).map((s) => s.id)
    const tokenIds = (shops || []).map((s) => s.token_id).filter(Boolean) as string[]

    // Inventory
    let invByShop: Record<string, any[]> = {}
    if (shopIds.length) {
      const { data: inv, error: iErr } = await supabase
        .from("shop_inventory")
        .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
        .in("shopkeeper_id", shopIds)

      if (iErr) {
        console.error("[api/shopkeepers] GET inventory error", { reqId, message: iErr.message })
        return NextResponse.json({ error: "Failed to load inventory" }, { status: 500 })
      }
      invByShop = (inv || []).reduce((acc: Record<string, any[]>, row) => {
        acc[row.shopkeeper_id] ||= []
        acc[row.shopkeeper_id].push(row)
        return acc
      }, {})
    }

    // Tokens
    let tokenById: Record<string, { id: string; image_url: string | null }> = {}
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase.from("tokens").select("id,image_url").in("id", tokenIds)
      if (tErr) {
        console.error("[api/shopkeepers] GET tokens error", { reqId, message: tErr.message })
      } else {
        tokenById = Object.fromEntries((tokens || []).map((t) => [t.id, t]))
      }
    }

    const shopkeepers = (shops || []).map((s) => ({
      id: s.id,
      name: s.name,
      race: s.race,
      age: s.age,
      alignment: s.alignment,
      quote: s.quote,
      description: s.description,
      shop_type: s.shop_type,
      created_at: s.created_at,
      image_url: s.token_id ? tokenById[s.token_id]?.image_url || null : null,
      inventory: invByShop[s.id] || [],
    }))

    console.log("[api/shopkeepers] GET done", {
      reqId,
      campaignId,
      count: shopkeepers.length,
      isOwner,
      access: campaign.access_enabled,
    })

    return NextResponse.json({
      campaign: { id: campaign.id, name: campaign.name, access_enabled: campaign.access_enabled, isOwner },
      shopkeepers,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

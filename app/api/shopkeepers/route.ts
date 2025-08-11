import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function GET(req: NextRequest) {
  const reqId = rid()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || ""
  const { userId, sessionId } = getAuth(req)
  console.log("[api/shopkeepers] GET start", { reqId, userId: !!userId, sessionId, campaignId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  try {
    const supabase = createAdminClient()

    // Campaign access
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()

    if (cErr || !campaign) {
      console.warn("[api/shopkeepers] campaign not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === userId
    if (!isOwner && !campaign.access_enabled) {
      console.warn("[api/shopkeepers] access disabled for non-owner", { reqId })
      return NextResponse.json({ campaign: { ...campaign, isOwner }, shopkeepers: [] })
    }

    // Try with removed filter; if column missing, fallback without it
    let shops:
      | {
          id: string
          name: string
          race: string
          age: number
          alignment: string
          quote: string
          description: string
          shop_type: string
          token_id: string | null
          created_at: string
        }[]
      | null = null

    let sErr: any = null
    {
      const { data, error } = await supabase
        .from("shopkeepers")
        .select("id,name,race,age,alignment,quote,description,shop_type,token_id,created_at")
        .eq("campaign_id", campaignId)
        .eq("removed", false)
        .order("created_at", { ascending: false })
      shops = data
      sErr = error
    }

    if (sErr && String(sErr.message).toLowerCase().includes("removed")) {
      console.warn("[api/shopkeepers] removed column missing, falling back", { reqId })
      const { data, error } = await supabase
        .from("shopkeepers")
        .select("id,name,race,age,alignment,quote,description,shop_type,token_id,created_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
      shops = data
      sErr = error
    }

    if (sErr) {
      console.error("[api/shopkeepers] shops error", { reqId, message: sErr.message })
      return NextResponse.json({ error: "Failed to load shopkeepers" }, { status: 500 })
    }

    // Tokens
    const tokenIds = (shops || []).map((s) => s.token_id).filter(Boolean) as string[]
    let tokenMap = new Map<string, string>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase
        .from("tokens")
        .select("id,image_url")
        .in("id", tokenIds as string[])
      if (tErr) {
        console.error("[api/shopkeepers] tokens error", { reqId, message: tErr.message })
      } else if (tokens) {
        tokenMap = new Map(tokens.map((t) => [String(t.id), String(t.image_url)]))
      }
    }

    // Inventory
    const shopIds = (shops || []).map((s) => s.id)
    const invByShop = new Map<string, any[]>()
    if (shopIds.length) {
      const { data: inv, error: iErr } = await supabase
        .from("shop_inventory")
        .select(
          "id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity,created_at",
        )
        .in("shopkeeper_id", shopIds as string[])
      if (iErr) {
        console.error("[api/shopkeepers] inventory error", { reqId, message: iErr.message })
      } else {
        for (const r of inv || []) {
          const arr = invByShop.get(r.shopkeeper_id) || []
          arr.push(r)
          invByShop.set(r.shopkeeper_id, arr)
        }
      }
    }

    const result = (shops || []).map((s) => ({
      ...s,
      image_url: s.token_id ? tokenMap.get(String(s.token_id)) || null : null,
      inventory: invByShop.get(s.id) || [],
    }))

    console.log("[api/shopkeepers] done", {
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

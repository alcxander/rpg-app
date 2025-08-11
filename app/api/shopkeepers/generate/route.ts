import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"
import { generateShopkeepers } from "@/lib/shops/generator"
import { generateTokenImage } from "@/lib/token-image"

const ENEMY_FALLBACKS = [
  "/tokens/enemies/1.png",
  "/tokens/enemies/2.png",
  "/tokens/enemies/3.png",
  "/tokens/enemies/4.png",
  "/tokens/enemies/5.png",
]
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  console.log("[api/shopkeepers.generate] start", { reqId, hasUser: !!userId, sessionId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const raw = await req.text()
    const body = raw ? JSON.parse(raw) : {}
    const campaignId: string | undefined = body?.campaignId
    const requestedCount: number = Number(body?.count ?? 1)
    console.log("[api/shopkeepers.generate] body", { reqId, campaignId, requestedCount })

    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Ownership check (owner_id is DM)
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[api/shopkeepers.generate] campaign", {
      reqId,
      error: cErr?.message || null,
      owner_id: campaign?.owner_id,
    })
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const safeRequested = Math.max(1, Math.min(20, Number.isFinite(requestedCount) ? requestedCount : 1))

    // Count existing active shopkeepers
    const { count: activeCount, error: countErr } = await supabase
      .from("shopkeepers")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("removed", false)

    console.log("[api/shopkeepers.generate] top-up pre", {
      reqId,
      activeCount: activeCount ?? 0,
      requested: safeRequested,
      countErr: countErr?.message || null,
    })

    const missing = Math.max(0, safeRequested - (activeCount ?? 0))
    if (missing <= 0) {
      return NextResponse.json({
        ok: true,
        created: [],
        message: "Already have enough active shopkeepers",
        activeCount: activeCount ?? 0,
        requested: safeRequested,
      })
    }

    console.log("[api/shopkeepers.generate] generating", { reqId, missing })
    const generated = generateShopkeepers(missing)
    const created: any[] = []
    let idx = 0

    for (const g of generated) {
      console.log("[api/shopkeepers.generate] begin", {
        reqId,
        idx,
        name: g.name,
        type: g.shop_type,
        items: g.items.length,
      })

      const prompt = `Portrait token of a ${g.race} ${g.shop_type} shopkeeper, ${g.description}. Cinematic soft lighting, fantasy RPG, subtle background, centered head-and-shoulders, 1:1 aspect ratio.`
      let imageUrl: string | null = null
      try {
        imageUrl = await generateTokenImage(prompt)
      } catch (err: any) {
        console.error("[api/shopkeepers.generate] image generation error", { reqId, idx, message: err?.message })
      }
      if (!imageUrl) imageUrl = pick(ENEMY_FALLBACKS)
      console.log("[api/shopkeepers.generate] token image", {
        reqId,
        idx,
        source: imageUrl?.startsWith("data:") ? "stability" : "fallback",
      })

      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .insert({ type: "shopkeeper", image_url: imageUrl, description: prompt, campaign_id: campaignId })
        .select("id,image_url")
        .single()
      console.log("[api/shopkeepers.generate] token insert", { reqId, idx, tokenId: token?.id, error: tErr?.message })

      const { data: shop, error: sErr } = await supabase
        .from("shopkeepers")
        .insert({
          campaign_id: campaignId,
          name: g.name,
          race: g.race,
          age: g.age,
          alignment: g.alignment,
          quote: g.quote,
          description: g.description,
          shop_type: g.shop_type,
          token_id: token?.id ?? null,
          removed: false,
          removed_at: null,
        })
        .select("id,name,shop_type,token_id,created_at")
        .single()
      console.log("[api/shopkeepers.generate] shop insert", { reqId, idx, shopId: shop?.id, error: sErr?.message })

      if (sErr || !shop) {
        idx++
        continue
      }

      if (g.items.length) {
        const invRows = g.items.map((it) => ({
          shopkeeper_id: shop.id,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        }))
        const { error: iErr } = await supabase.from("shop_inventory").insert(invRows)
        console.log("[api/shopkeepers.generate] inventory insert", {
          reqId,
          idx,
          rows: invRows.length,
          error: iErr?.message || null,
        })
      }

      created.push({
        ...shop,
        image_url: token?.image_url ?? imageUrl,
        image_prompt: prompt,
        image_provider: imageUrl?.startsWith("data:") ? "stability" : "fallback",
      })
      console.log("[api/shopkeepers.generate] end", { reqId, idx })
      idx++
    }

    console.log("[api/shopkeepers.generate] done", {
      reqId,
      created: created.length,
      requested: safeRequested,
      activeBefore: activeCount ?? 0,
    })
    return NextResponse.json({
      ok: true,
      created,
      requested: safeRequested,
      activeBefore: activeCount ?? 0,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers.generate] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

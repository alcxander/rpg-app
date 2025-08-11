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
    const body = await req.json().catch(() => ({}))
    const campaignId: string | undefined = body?.campaignId
    const requestedCount: number = Number(body?.count ?? 1)
    console.log("[api/shopkeepers.generate] body", { reqId, campaignId, requestedCount })

    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Ownership check
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) {
      console.warn("[api/shopkeepers.generate] campaign not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    if (campaign.owner_id !== userId) {
      console.warn("[api/shopkeepers.generate] forbidden (not owner)", { reqId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const safeRequested = Math.max(1, Math.min(20, Number.isFinite(requestedCount) ? requestedCount : 1))

    // Count existing active shopkeepers, with fallback if "removed" column doesn’t exist
    let activeCount = 0
    {
      const { count, error } = await supabase
        .from("shopkeepers")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("removed", false)

      if (error && String(error.message).toLowerCase().includes("removed")) {
        const { count: c2, error: e2 } = await supabase
          .from("shopkeepers")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
        activeCount = c2 ?? 0
        if (e2) console.error("[api/shopkeepers.generate] count fallback error", { reqId, message: e2.message })
      } else {
        activeCount = count ?? 0
        if (error) console.error("[api/shopkeepers.generate] count error", { reqId, message: error.message })
      }
    }

    const missing = Math.max(0, safeRequested - activeCount)
    console.log("[api/shopkeepers.generate] top-up", { reqId, requested: safeRequested, activeCount, missing })

    if (missing <= 0) {
      return NextResponse.json({
        ok: true,
        createdCount: 0,
        createdIds: [],
        requested: safeRequested,
        activeBefore: activeCount,
        message: "Already have enough active shopkeepers",
      })
    }

    const generated = generateShopkeepers(missing)
    const createdIds: string[] = []
    let tokenInsertErrors = 0
    let shopInsertErrors = 0
    let invInsertErrors = 0

    for (let idx = 0; idx < generated.length; idx++) {
      const g = generated[idx]
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
        console.error("[api/shopkeepers.generate] stability error", { reqId, idx, message: err?.message })
      }
      if (!imageUrl) imageUrl = pick(ENEMY_FALLBACKS)

      // token
      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .insert({ type: "shopkeeper", image_url: imageUrl, description: prompt, campaign_id: campaignId })
        .select("id")
        .single()
      if (tErr || !token) {
        tokenInsertErrors++
        console.error("[api/shopkeepers.generate] token insert error", { reqId, idx, message: tErr?.message })
        continue
      }

      // shopkeeper
      const baseShop = {
        campaign_id: campaignId,
        name: g.name,
        race: g.race,
        age: g.age,
        alignment: g.alignment,
        quote: g.quote,
        description: g.description,
        shop_type: g.shop_type,
        token_id: token.id as string,
      }

      let shopId: string | null = null
      {
        const { data: shop1, error: sErr1 } = await supabase
          .from("shopkeepers")
          .insert({ ...baseShop, removed: false, removed_at: null })
          .select("id")
          .single()

        if (sErr1 && String(sErr1.message).toLowerCase().includes("removed")) {
          const { data: shop2, error: sErr2 } = await supabase
            .from("shopkeepers")
            .insert(baseShop)
            .select("id")
            .single()
          if (sErr2 || !shop2) {
            shopInsertErrors++
            console.error("[api/shopkeepers.generate] shop insert error (fallback)", {
              reqId,
              idx,
              message: sErr2?.message,
            })
            continue
          }
          shopId = shop2.id as string
        } else if (sErr1 || !shop1) {
          shopInsertErrors++
          console.error("[api/shopkeepers.generate] shop insert error", { reqId, idx, message: sErr1?.message })
          continue
        } else {
          shopId = shop1.id as string
        }
      }

      // inventory
      if (g.items.length && shopId) {
        const invRows = g.items.map((it) => ({
          shopkeeper_id: shopId!,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        }))
        const { error: iErr } = await supabase.from("shop_inventory").insert(invRows)
        if (iErr) {
          invInsertErrors++
          console.error("[api/shopkeepers.generate] inventory insert error", { reqId, idx, message: iErr.message })
        }
      }

      if (shopId) createdIds.push(shopId)
      console.log("[api/shopkeepers.generate] end", { reqId, idx, shopId })
    }

    console.log("[api/shopkeepers.generate] done", {
      reqId,
      createdCount: createdIds.length,
      requested: safeRequested,
      activeBefore: activeCount,
      tokenInsertErrors,
      shopInsertErrors,
      invInsertErrors,
    })

    // Important: respond with a small payload (no base64s)
    return NextResponse.json({
      ok: true,
      createdCount: createdIds.length,
      createdIds,
      requested: safeRequested,
      activeBefore: activeCount,
      tokenInsertErrors,
      shopInsertErrors,
      invInsertErrors,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers.generate] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

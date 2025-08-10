import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function POST(req: NextRequest) {
  const { userId } = auth()
  const reqId = rid()
  const t0 = Date.now()
  console.log("[api/shopkeepers.generate] start", { reqId, userId })

  if (!userId) {
    console.warn("[api/shopkeepers.generate] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const raw = await req.text()
    console.log("[api/shopkeepers.generate] raw body", { reqId, rawLen: raw.length })
    const body = raw ? JSON.parse(raw) : {}
    const campaignId = body?.campaignId
    const count = Number(body?.count ?? 5)
    console.log("[api/shopkeepers.generate] parsed body", { reqId, campaignId, count })

    if (!campaignId) {
      console.warn("[api/shopkeepers.generate] missing campaignId", { reqId })
      return NextResponse.json({ error: "campaignId required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check DM
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,dm_id,access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[api/shopkeepers.generate] campaign", { reqId, cErr, campaignId, dm_id: campaign?.dm_id })

    if (cErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    if (campaign.dm_id !== userId) {
      console.warn("[api/shopkeepers.generate] forbidden (not DM)", { reqId, userId, dm_id: campaign.dm_id })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const howMany = Math.max(5, Math.min(20, isFinite(count) ? count : 5))
    console.log("[api/shopkeepers.generate] generating", { reqId, howMany })
    const generated = generateShopkeepers(howMany)

    const created: any[] = []
    let idx = 0
    for (const g of generated) {
      const loopStart = Date.now()
      console.log("[api/shopkeepers.generate] loop begin", {
        reqId,
        idx,
        name: g.name,
        type: g.shop_type,
        items: g.items.length,
      })

      // Image
      const prompt = `Portrait token of a ${g.race} ${g.shop_type} shopkeeper, ${g.description}`
      console.log("[api/shopkeepers.generate] image prompt", { reqId, idx, len: prompt.length })
      const imageUrl = (await generateTokenImage(prompt)) || pick(ENEMY_FALLBACKS)
      console.log("[api/shopkeepers.generate] image chosen", {
        reqId,
        idx,
        isFallback: !imageUrl.startsWith("data:"),
        urlPreview: imageUrl.substring(0, 30),
      })

      // Token insert
      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .insert({
          type: "shopkeeper",
          image_url: imageUrl,
          description: prompt,
          campaign_id: campaignId,
        })
        .select("id,image_url")
        .single()
      console.log("[api/shopkeepers.generate] token insert", { reqId, idx, tErr, tokenId: token?.id })

      // Shopkeeper insert
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
        })
        .select("id,name,shop_type,token_id,created_at")
        .single()
      console.log("[api/shopkeepers.generate] shopkeeper insert", { reqId, idx, sErr, shopId: shop?.id })

      if (sErr || !shop) {
        console.error("[api/shopkeepers.generate] shopkeeper insert failed, skipping inventory", { reqId, idx, sErr })
        idx++
        continue
      }

      // Inventory insert
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
          iErr,
        })
      }

      created.push({ ...shop, image_url: token?.image_url ?? imageUrl })
      console.log("[api/shopkeepers.generate] loop end", { reqId, idx, ms: Date.now() - loopStart })
      idx++
    }

    console.log("[api/shopkeepers.generate] done", { reqId, created: created.length, ms: Date.now() - t0 })
    return NextResponse.json({ ok: true, created })
  } catch (e: any) {
    console.error("[api/shopkeepers.generate] exception", {
      reqId,
      message: e?.message,
      stack: e?.stack,
    })
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 })
  }
}

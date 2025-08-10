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
  console.log("[shopkeepers.generate] request start", { reqId, userId })

  if (!userId) {
    console.warn("[shopkeepers.generate] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId = body?.campaignId
    const count = Number(body?.count ?? 5)
    console.log("[shopkeepers.generate] parsed body", { reqId, campaignId, count })

    if (!campaignId) {
      console.warn("[shopkeepers.generate] missing campaignId", { reqId })
      return NextResponse.json({ error: "campaignId required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    console.log("[shopkeepers.generate] checking campaign", { reqId, campaignId })

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, dm_id, access_enabled")
      .eq("id", campaignId)
      .single()

    console.log("[shopkeepers.generate] campaign query result", { reqId, cErr, campaign })
    if (cErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    if (campaign.dm_id !== userId) {
      console.warn("[shopkeepers.generate] forbidden (not DM)", { reqId, userId, dm_id: campaign.dm_id })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const howMany = Math.max(5, Math.min(20, isFinite(count) ? count : 5))
    console.log("[shopkeepers.generate] generating", { reqId, howMany })
    const generated = generateShopkeepers(howMany)

    const created: any[] = []
    for (const [idx, g] of generated.entries()) {
      console.log("[shopkeepers.generate] begin shopkeeper", {
        reqId,
        idx,
        name: g.name,
        type: g.shop_type,
        items: g.items.length,
      })

      // Attempt image
      const prompt = `Portrait token of a ${g.race} ${g.shop_type} shopkeeper, ${g.description}`
      console.log("[shopkeepers.generate] generate image", { reqId, idx, promptLen: prompt.length })
      const imageUrl = (await generateTokenImage(prompt)) || pick(ENEMY_FALLBACKS)
      console.log("[shopkeepers.generate] image resolved", { reqId, idx, usesFallback: !imageUrl.startsWith("data:") })

      // Save token
      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .insert({
          type: "shopkeeper",
          image_url: imageUrl,
          description: prompt,
          campaign_id: campaignId,
        })
        .select("id, image_url")
        .single()
      console.log("[shopkeepers.generate] token insert", { reqId, idx, tErr, token })

      // Save shopkeeper
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
        .select("id, name, shop_type, token_id, created_at")
        .single()
      console.log("[shopkeepers.generate] shopkeeper insert", { reqId, idx, sErr, shop })

      if (sErr || !shop) {
        console.error("[shopkeepers.generate] shopkeeper insert failed, skipping inventory", { reqId, idx, sErr })
        continue
      }

      // Save inventory rows
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
        console.log("[shopkeepers.generate] inserting inventory", { reqId, idx, rows: invRows.length })
        const { error: iErr } = await supabase.from("shop_inventory").insert(invRows)
        console.log("[shopkeepers.generate] inventory insert result", { reqId, idx, iErr })
      }

      created.push({ ...shop, image_url: token?.image_url ?? imageUrl })
    }

    console.log("[shopkeepers.generate] done", { reqId, created: created.length })
    return NextResponse.json({ ok: true, created })
  } catch (e: any) {
    console.error("[shopkeepers.generate] exception", {
      reqId,
      message: e?.message,
      stack: e?.stack,
    })
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 })
  }
}

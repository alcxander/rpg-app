import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"
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

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { campaignId, count = 5 } = await req.json()
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createClient()

    // Verify owner (DM)
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const generated = generateShopkeepers(Math.max(5, Math.min(20, Number(count) || 5)))

    const out: any[] = []
    for (const g of generated) {
      // Try generate image
      const prompt = `Portrait token, ${g.race} shopkeeper, ${g.description}.`
      const imageUrl = (await generateTokenImage(prompt)) || pick(ENEMY_FALLBACKS)

      // Save token
      const { data: token, error: tErr } = await supabase
        .from("tokens")
        .insert({ type: "shopkeeper", image_url: imageUrl, description: prompt, campaign_id: campaignId })
        .select("id, image_url")
        .single()
      if (tErr) {
        // even if token insert fails, continue with null token and fallback shown by client
        console.error("Token insert failed", tErr)
      }

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
        .select("id, name, shop_type, token_id")
        .single()

      if (sErr || !shop) {
        console.error("Shopkeeper insert failed", sErr)
        continue
      }

      // Save inventory
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
      if (iErr) console.error("Inventory insert failed", iErr)

      out.push({ ...shop, image_url: token?.image_url ?? imageUrl })
    }

    return NextResponse.json({ ok: true, created: out })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

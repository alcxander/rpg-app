import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function POST(req: NextRequest) {
  const reqId = rid()
  try {
    const { userId } = getAuth(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { campaignId } = await req.json().catch(() => ({ campaignId: "" }))
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Ownership
    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", campaignId)
      .single()
    if (campErr || !camp) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Grab up to 50 active shopkeepers from anywhere, then pick 5 random
    const { data: pool, error: poolErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,image_url,created_at")
      .or("removed.is.null,removed.eq.false")
      .limit(50)
    if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 })
    if (!pool || pool.length === 0) {
      return NextResponse.json({ error: "No source shopkeepers available to seed" }, { status: 400 })
    }

    const pick = (arr: any[], n: number) => {
      const copy = arr.slice()
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy.slice(0, n)
    }
    const chosen = pick(pool, Math.min(5, pool.length))

    // Fetch inventories for chosen
    const chosenIds = chosen.map((c) => c.id)
    const { data: items, error: itemsErr } = await supabase
      .from("shopkeeper_inventory")
      .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
      .in("shopkeeper_id", chosenIds)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    // Clone
    const createdIds: string[] = []
    for (const src of chosen) {
      const { data: sk, error: insErr } = await supabase
        .from("shopkeepers")
        .insert({
          campaign_id: campaignId,
          name: src.name,
          race: src.race,
          age: src.age,
          alignment: src.alignment,
          quote: src.quote,
          description: src.description,
          shop_type: src.shop_type,
          image_url: src.image_url,
          removed: false,
        })
        .select("id")
        .single()
      if (insErr || !sk?.id) continue
      const srcItems = (items ?? []).filter((it) => it.shopkeeper_id === src.id)
      if (srcItems.length > 0) {
        const payload = srcItems.map((it) => ({
          shopkeeper_id: sk.id,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        }))
        await supabase.from("shopkeeper_inventory").insert(payload)
      }
      createdIds.push(sk.id)
    }

    console.log("[api/shopkeepers.quick-seed] done", { reqId, created: createdIds.length })
    return NextResponse.json({ createdCount: createdIds.length, createdIds })
  } catch (e: any) {
    console.error("[api/shopkeepers.quick-seed] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

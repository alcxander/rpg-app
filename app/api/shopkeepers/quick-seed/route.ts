import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  const reqId = rid()
  const { userId } = getAuth(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId: string | undefined = body?.campaignId
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Ownership
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Pull a pool of existing active shopkeepers (any campaign), fallback if 'removed' column missing
    let pool:
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
        }[]
      | null = null
    {
      const { data, error } = await supabase
        .from("shopkeepers")
        .select("id,name,race,age,alignment,quote,description,shop_type,token_id")
        .eq("removed", false)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error && String(error.message).toLowerCase().includes("removed")) {
        const { data: d2, error: e2 } = await supabase
          .from("shopkeepers")
          .select("id,name,race,age,alignment,quote,description,shop_type,token_id")
          .order("created_at", { ascending: false })
          .limit(50)
        pool = d2 || []
        if (e2) console.error("[api/shopkeepers.quick-seed] pool fallback error", { reqId, message: e2.message })
      } else {
        pool = data || []
        if (error) console.error("[api/shopkeepers.quick-seed] pool error", { reqId, message: error.message })
      }
    }

    if (!pool || pool.length === 0) {
      return NextResponse.json({ error: "No source shopkeepers to seed from" }, { status: 404 })
    }

    // Pick up to 5 random
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 5)

    const tokenIds = selected.map((s) => s.token_id).filter(Boolean) as string[]
    let tokenMap = new Map<string, { image_url: string | null; description: string | null }>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase
        .from("tokens")
        .select("id,image_url,description")
        .in("id", tokenIds)
      if (tErr) {
        console.error("[api/shopkeepers.quick-seed] tokens error", { reqId, message: tErr.message })
      } else if (tokens) {
        tokenMap = new Map(tokens.map((t) => [String(t.id), { image_url: t.image_url, description: t.description }]))
      }
    }

    // Inventories of selected
    const selectedIds = selected.map((s) => s.id)
    const { data: inv, error: iErr } = await supabase
      .from("shop_inventory")
      .select(
        "id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity,created_at",
      )
      .in("shopkeeper_id", selectedIds)
    if (iErr) console.error("[api/shopkeepers.quick-seed] inventory error", { reqId, message: iErr.message })
    const invByShop = new Map<string, any[]>()
    for (const r of inv || []) {
      const arr = invByShop.get(r.shopkeeper_id) || []
      arr.push(r)
      invByShop.set(r.shopkeeper_id, arr)
    }

    let created = 0
    for (let idx = 0; idx < selected.length; idx++) {
      const src = selected[idx]
      // Duplicate token for this campaign to keep references separate
      let newTokenId: string | null = null
      if (src.token_id) {
        const t = tokenMap.get(String(src.token_id))
        const { data: newToken, error: nErr } = await supabase
          .from("tokens")
          .insert({
            type: "shopkeeper",
            image_url: t?.image_url ?? null,
            description: t?.description ?? null,
            campaign_id: campaignId,
          })
          .select("id")
          .single()
        if (nErr) {
          console.error("[api/shopkeepers.quick-seed] token clone error", { reqId, idx, message: nErr.message })
        } else {
          newTokenId = newToken?.id ?? null
        }
      }

      // Insert new shopkeeper
      const baseShop = {
        campaign_id: campaignId,
        name: src.name,
        race: src.race,
        age: src.age,
        alignment: src.alignment,
        quote: src.quote,
        description: src.description,
        shop_type: src.shop_type,
        token_id: newTokenId,
      }

      let shopId: string | null = null
      {
        const { data: s1, error: e1 } = await supabase
          .from("shopkeepers")
          .insert({ ...baseShop, removed: false, removed_at: null })
          .select("id")
          .single()
        if (e1 && String(e1.message).toLowerCase().includes("removed")) {
          const { data: s2, error: e2 } = await supabase.from("shopkeepers").insert(baseShop).select("id").single()
          if (e2 || !s2) {
            console.error("[api/shopkeepers.quick-seed] shop insert fallback error", {
              reqId,
              idx,
              message: e2?.message,
            })
            continue
          }
          shopId = s2.id as string
        } else if (e1 || !s1) {
          console.error("[api/shopkeepers.quick-seed] shop insert error", { reqId, idx, message: e1?.message })
          continue
        } else {
          shopId = s1.id as string
        }
      }

      // Copy inventory
      if (shopId) {
        const rows = (invByShop.get(src.id) || []).map((it) => ({
          shopkeeper_id: shopId!,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        }))
        if (rows.length) {
          const { error: iErr2 } = await supabase.from("shop_inventory").insert(rows)
          if (iErr2) {
            console.error("[api/shopkeepers.quick-seed] inventory insert error", { reqId, idx, message: iErr2.message })
          }
        }
        created++
      }
    }

    console.log("[api/shopkeepers.quick-seed] done", { reqId, created })
    return NextResponse.json({ ok: true, created })
  } catch (e: any) {
    console.error("[api/shopkeepers.quick-seed] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

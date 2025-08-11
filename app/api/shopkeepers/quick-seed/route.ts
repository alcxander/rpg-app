import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  console.log("[api/shopkeepers.quick-seed] start", { reqId, hasUser: !!userId, sessionId })
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { campaignId } = await req.json().catch(() => ({ campaignId: undefined }))
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Ownership check
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Load a pool of shopkeepers from other campaigns (active ones)
    const { data: pool, error: pErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id,name,race,age,alignment,quote,description,shop_type,token_id")
      .neq("campaign_id", campaignId)
      .limit(50)
    if (pErr) {
      console.error("[api/shopkeepers.quick-seed] pool error", { reqId, message: pErr.message })
      return NextResponse.json({ error: "Failed to load pool" }, { status: 500 })
    }

    // Shuffle and pick 5
    const list = [...(pool || [])]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    const picks = list.slice(0, Math.min(5, list.length))

    // If pool is empty, short-circuit
    if (!picks.length) {
      return NextResponse.json({
        ok: true,
        createdCount: 0,
        createdIds: [],
        message: "No global shopkeepers available to seed",
      })
    }

    // Load tokens for picks
    const tokenIds = picks.map((p) => p.token_id).filter(Boolean) as string[]
    let tokenMap = new Map<string, { image_url: string | null; description: string | null }>()
    if (tokenIds.length) {
      const { data: tokens, error: tErr } = await supabase
        .from("tokens")
        .select("id,image_url,description")
        .in("id", tokenIds)
      if (tokens)
        tokenMap = new Map(tokens.map((t) => [String(t.id), { image_url: t.image_url, description: t.description }]))
      if (tErr) console.error("[api/shopkeepers.quick-seed] tokens error", { reqId, message: tErr.message })
    }

    // Load inventory rows for picks
    const pickIds = picks.map((p) => p.id)
    const invMap = new Map<string, any[]>()
    if (pickIds.length) {
      const { data: inv, error: iErr } = await supabase
        .from("shop_inventory")
        .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
        .in("shopkeeper_id", pickIds)
      if (inv) {
        for (const row of inv) {
          const arr = invMap.get(row.shopkeeper_id) || []
          arr.push(row)
          invMap.set(row.shopkeeper_id, arr)
        }
      }
      if (iErr) console.error("[api/shopkeepers.quick-seed] inventory error", { reqId, message: iErr.message })
    }

    // Clone each pick into this campaign
    const createdIds: string[] = []
    for (let idx = 0; idx < picks.length; idx++) {
      const p = picks[idx]

      // duplicate token row (so campaign filters still work)
      let tokenId: string | null = null
      {
        const tok = p.token_id ? tokenMap.get(String(p.token_id)) : null
        const { data: newTok, error: ntErr } = await supabase
          .from("tokens")
          .insert({
            type: "shopkeeper",
            image_url: tok?.image_url ?? null,
            description: tok?.description ?? null,
            campaign_id: campaignId,
          })
          .select("id")
          .single()
        if (ntErr || !newTok) {
          console.error("[api/shopkeepers.quick-seed] token clone error", { reqId, idx, message: ntErr?.message })
          continue
        }
        tokenId = newTok.id as string
      }

      // insert cloned shopkeeper
      const { data: newSk, error: sErr } = await supabase
        .from("shopkeepers")
        .insert({
          campaign_id: campaignId,
          name: p.name,
          race: p.race,
          age: p.age,
          alignment: p.alignment,
          quote: p.quote,
          description: p.description,
          shop_type: p.shop_type,
          token_id: tokenId,
          removed: false,
          removed_at: null,
        })
        .select("id")
        .single()

      if (sErr && String(sErr.message).toLowerCase().includes("removed")) {
        const { data: newSk2, error: sErr2 } = await supabase
          .from("shopkeepers")
          .insert({
            campaign_id: campaignId,
            name: p.name,
            race: p.race,
            age: p.age,
            alignment: p.alignment,
            quote: p.quote,
            description: p.description,
            shop_type: p.shop_type,
            token_id: tokenId,
          })
          .select("id")
          .single()
        if (sErr2 || !newSk2) {
          console.error("[api/shopkeepers.quick-seed] shop clone error (fallback)", {
            reqId,
            idx,
            message: sErr2?.message,
          })
          continue
        }
        createdIds.push(newSk2.id as string)

        // clone inventory
        const srcItems = invMap.get(p.id) || []
        if (srcItems.length) {
          const rows = srcItems.map((r) => ({
            shopkeeper_id: newSk2.id as string,
            item_name: r.item_name,
            rarity: r.rarity,
            base_price: r.base_price,
            price_adjustment_percent: r.price_adjustment_percent,
            final_price: r.final_price,
            stock_quantity: r.stock_quantity,
          }))
          await supabase.from("shop_inventory").insert(rows)
        }
      } else if (sErr || !newSk) {
        console.error("[api/shopkeepers.quick-seed] shop clone error", { reqId, idx, message: sErr?.message })
        continue
      } else {
        createdIds.push(newSk.id as string)
        const srcItems = invMap.get(p.id) || []
        if (srcItems.length) {
          const rows = srcItems.map((r) => ({
            shopkeeper_id: newSk.id as string,
            item_name: r.item_name,
            rarity: r.rarity,
            base_price: r.base_price,
            price_adjustment_percent: r.price_adjustment_percent,
            final_price: r.final_price,
            stock_quantity: r.stock_quantity,
          }))
          await supabase.from("shop_inventory").insert(rows)
        }
      }
    }

    console.log("[api/shopkeepers.quick-seed] done", { reqId, createdCount: createdIds.length })
    return NextResponse.json({ ok: true, createdCount: createdIds.length, createdIds })
  } catch (e: any) {
    console.error("[api/shopkeepers.quick-seed] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

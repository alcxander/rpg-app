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
    const { campaignId } = (await req.json().catch(() => ({}))) as { campaignId?: string }
    if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

    const supabase = createAdminClient()

    // Owner check
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Ensure there are zero active shopkeepers before seeding (as requested)
    const { count: activeCount } = await supabase
      .from("shopkeepers")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("removed", false)
    if ((activeCount ?? 0) > 0) {
      return NextResponse.json({ ok: false, message: "Campaign already has shopkeepers" }, { status: 400 })
    }

    // Pick 5 random active shopkeepers from the global pool (any campaign), to clone
    const { data: sourceShops, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,token_id")
      .eq("removed", false)
      .order("created_at", { ascending: false })
      .limit(100) // sample pool
    if (sErr) return NextResponse.json({ error: "Failed to query source shopkeepers" }, { status: 500 })
    if (!sourceShops?.length) return NextResponse.json({ error: "No source shopkeepers to seed from" }, { status: 400 })

    // Randomly take 5 from the pool
    const pool = [...sourceShops]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const picks = pool.slice(0, Math.min(5, pool.length))

    // Tokens for picks
    const tokenIds = picks.map((p) => p.token_id).filter(Boolean) as string[]
    let tokenById = new Map<string, { id: string; image_url: string | null; description: string | null }>()
    if (tokenIds.length) {
      const { data: tokens } = await supabase.from("tokens").select("id,image_url,description").in("id", tokenIds)
      if (tokens) {
        tokenById = new Map(
          tokens.map((t) => [
            String(t.id),
            { id: String(t.id), image_url: t.image_url, description: (t as any).description ?? null },
          ]),
        )
      }
    }

    // Inventories of picks
    const pickIds = picks.map((p) => p.id)
    const { data: invRows, error: iErr } = await supabase
      .from("shop_inventory")
      .select(
        "id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity,created_at",
      )
      .in("shopkeeper_id", pickIds)
    if (iErr) return NextResponse.json({ error: "Failed to query inventory for seeds" }, { status: 500 })

    // Clone into target campaign
    const created: any[] = []
    for (const p of picks) {
      // duplicate token row for this campaign (keep same image_url/description)
      let newTokenId: string | null = null
      const tok = p.token_id ? tokenById.get(String(p.token_id)) : null
      if (tok) {
        const { data: newTok, error: tErr } = await supabase
          .from("tokens")
          .insert({
            type: "shopkeeper",
            image_url: tok.image_url,
            description: tok.description || "seeded image",
            campaign_id: campaignId,
          })
          .select("id,image_url")
          .single()
        if (!tErr && newTok) newTokenId = String(newTok.id)
      }

      const { data: newShop, error: s2Err } = await supabase
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
          token_id: newTokenId,
          removed: false,
          removed_at: null,
        })
        .select("id,name,shop_type,token_id,created_at")
        .single()
      if (s2Err || !newShop) continue

      const rowsForThis = (invRows || []).filter((r) => r.shopkeeper_id === p.id)
      if (rowsForThis.length) {
        const clones = rowsForThis.map((r) => ({
          shopkeeper_id: newShop.id,
          item_name: r.item_name,
          rarity: r.rarity,
          base_price: r.base_price,
          price_adjustment_percent: r.price_adjustment_percent,
          final_price: r.final_price,
          stock_quantity: r.stock_quantity,
        }))
        await supabase.from("shop_inventory").insert(clones)
      }

      created.push(newShop)
    }

    console.log("[api/shopkeepers.quick-seed] done", { reqId, created: created.length })
    return NextResponse.json({ ok: true, created })
  } catch (e: any) {
    console.error("[api/shopkeepers.quick-seed] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId")
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 })

  // Campaign
  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .select("id, owner_id, access_enabled")
    .eq("id", campaignId)
    .single()
  if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  // Determine access: owner sees regardless; players require access_enabled
  const isOwner = campaign.owner_id === userId
  let isMember = false
  if (!isOwner) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, participants, campaign_id")
      .eq("campaign_id", campaignId)
    isMember = (sessions || []).some((s) => {
      const arr = Array.isArray(s.participants) ? s.participants : []
      return arr.some((p: any) => String(p?.userId) === userId)
    })
    if (!campaign.access_enabled && !isOwner) {
      return NextResponse.json({ error: "Shop access disabled by DM" }, { status: 403 })
    }
    if (!isMember && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Fetch shopkeepers with token image
  const { data: shopkeepers, error: skErr } = await supabase
    .from("shopkeepers")
    .select("id, name, race, age, alignment, quote, description, shop_type, token_id, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
  if (skErr) return NextResponse.json({ error: "Failed to load shopkeepers" }, { status: 500 })

  // Token images
  const tokenIds = (shopkeepers || []).map((s) => s.token_id).filter(Boolean)
  const tokenMap = new Map<string, string>()
  if (tokenIds.length) {
    const { data: tokens } = await supabase
      .from("tokens")
      .select("id, image_url")
      .in("id", tokenIds as string[])
    ;(tokens || []).forEach((t) => tokenMap.set(t.id, t.image_url))
  }

  // Inventories
  const skIds = (shopkeepers || []).map((s) => s.id)
  const invMap = new Map<string, any[]>()
  if (skIds.length) {
    const { data: items } = await supabase
      .from("shop_inventory")
      .select("id, shopkeeper_id, item_name, rarity, base_price, price_adjustment_percent, final_price, stock_quantity")
      .in("shopkeeper_id", skIds)
    for (const it of items || []) {
      const arr = invMap.get(it.shopkeeper_id) || []
      arr.push(it)
      invMap.set(it.shopkeeper_id, arr)
    }
  }

  return NextResponse.json({
    ok: true,
    campaign: { id: campaign.id, access_enabled: campaign.access_enabled, isOwner },
    shopkeepers: (shopkeepers || []).map((s) => ({
      ...s,
      image_url: s.token_id ? tokenMap.get(s.token_id) || null : null,
      inventory: invMap.get(s.id) || [],
    })),
  })
}

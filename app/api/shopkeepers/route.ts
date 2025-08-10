import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

// GET /api/shopkeepers?campaignId=...
export async function GET(req: NextRequest) {
  const { userId } = auth()
  const reqId = rid()
  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId") || ""

  console.log("[shopkeepers.list] start", { reqId, userId, campaignId })
  if (!userId) {
    console.warn("[shopkeepers.list] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!campaignId) {
    console.warn("[shopkeepers.list] missing campaignId", { reqId })
    return NextResponse.json({ error: "campaignId required" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    // Fetch campaign to check access
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, dm_id, access_enabled")
      .eq("id", campaignId)
      .single()
    console.log("[shopkeepers.list] campaign lookup", { reqId, cErr, campaign })

    if (cErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isDM = campaign.dm_id === userId
    if (!isDM && !campaign.access_enabled) {
      console.warn("[shopkeepers.list] forbidden, access disabled for players", { reqId })
      return NextResponse.json({ error: "Access disabled" }, { status: 403 })
    }

    const { data: shops, error: sErr } = await supabase
      .from("shopkeepers")
      .select(
        `
        id,
        campaign_id,
        name,
        race,
        age,
        alignment,
        quote,
        description,
        shop_type,
        token_id,
        created_at,
        tokens:token_id ( image_url ),
        shop_inventory ( id, item_name, rarity, base_price, price_adjustment_percent, final_price, stock_quantity )
      `,
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })

    console.log("[shopkeepers.list] result", { reqId, sErr, count: shops?.length ?? 0 })
    const payload =
      shops?.map((s: any) => ({
        ...s,
        image_url: s?.tokens?.image_url ?? null,
      })) ?? []

    return NextResponse.json({ ok: true, isDM, shops: payload })
  } catch (e: any) {
    console.error("[shopkeepers.list] exception", { reqId, message: e?.message, stack: e?.stack })
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 })
  }
}

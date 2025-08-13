import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function GET(req: NextRequest) {
  const reqId = rid()
  const url = new URL(req.url)
  const campaignId = url.searchParams.get("campaignId") || ""

  try {
    const { userId } = await auth()
    console.log("[api/shopkeepers] GET start", {
      reqId,
      userId: !!userId,
      campaignId,
    })

    if (!campaignId) {
      console.log("[api/shopkeepers] GET missing campaignId", { reqId })
      return NextResponse.json({ error: "campaignId required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get campaign and check access
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single()

    if (campaignError || !campaign) {
      console.log("[api/shopkeepers] GET campaign not found", { reqId, error: campaignError })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // Check if user has access to this campaign
    let hasAccess = false
    let accessReason = ""

    if (userId && campaign.owner_id === userId) {
      hasAccess = true
      accessReason = "campaign owner"
    } else if (userId) {
      // Check if user is a member of the campaign
      const { data: membership, error: memberError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single()

      if (membership) {
        hasAccess = true
        accessReason = `campaign member (${membership.role})`
      } else if (memberError && memberError.code !== "PGRST116") {
        console.error("[api/shopkeepers] GET membership check error", { reqId, error: memberError })
      }
    }

    if (!hasAccess) {
      console.log("[api/shopkeepers] GET access denied", {
        reqId,
        userId,
        campaignId,
        campaignOwnerId: campaign.owner_id,
      })
      return NextResponse.json(
        {
          error: "Access denied. You must be a member of this campaign to view its shopkeepers.",
        },
        { status: 403 },
      )
    }

    console.log("[api/shopkeepers] GET access granted", { reqId, accessReason })

    // Get active shopkeepers (removed=false or null)
    const { data: shops, error: shopsErr } = await supabase
      .from("shopkeepers")
      .select("id,name,race,age,alignment,quote,description,shop_type,image_url,created_at")
      .eq("campaign_id", campaignId)
      .or("removed.is.null,removed.eq.false")
      .order("created_at", { ascending: false })

    if (shopsErr) {
      console.error("[api/shopkeepers] GET shops error", { reqId, error: shopsErr.message })
      return NextResponse.json({ error: shopsErr.message }, { status: 500 })
    }

    const ids = (shops ?? []).map((s) => s.id)
    let inventoryByShop: Record<string, any[]> = {}

    if (ids.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from("shopkeeper_inventory")
        .select("id,shopkeeper_id,item_name,rarity,base_price,price_adjustment_percent,final_price,stock_quantity")
        .in("shopkeeper_id", ids)

      if (itemsErr) {
        console.error("[api/shopkeepers] GET inventory error", { reqId, error: itemsErr.message })
        return NextResponse.json({ error: itemsErr.message }, { status: 500 })
      }

      inventoryByShop = (items ?? []).reduce((acc: Record<string, any[]>, it: any) => {
        const sid = it.shopkeeper_id
        if (!acc[sid]) acc[sid] = []
        acc[sid].push({
          id: it.id,
          item_name: it.item_name,
          rarity: it.rarity,
          base_price: it.base_price,
          price_adjustment_percent: it.price_adjustment_percent,
          final_price: it.final_price,
          stock_quantity: it.stock_quantity,
        })
        return acc
      }, {})
    }

    const result = (shops ?? []).map((s) => ({
      ...s,
      inventory: inventoryByShop[s.id] ?? [],
    }))

    console.log("[api/shopkeepers] GET success", {
      reqId,
      campaignId,
      count: result.length,
      accessReason,
    })

    return NextResponse.json({
      campaign: {
        id: campaignId,
        name: campaign.name,
        hasAccess: true,
        accessReason,
      },
      shopkeepers: result,
    })
  } catch (e: any) {
    console.error("[api/shopkeepers] GET exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

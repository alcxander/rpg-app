import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { shopkeeperId, itemId, campaignId } = await req.json()

    if (!shopkeeperId || !itemId || !campaignId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Check if user has access to this campaign
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("owner_id, access_enabled")
      .eq("id", campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === user.id
    let isMember = false

    if (!isOwner) {
      const { data: membership } = await supabaseAdmin
        .from("campaign_members")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .single()

      isMember = !!membership
    }

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Not authorized for this campaign" }, { status: 403 })
    }

    // Check if shop access is enabled (for non-owners)
    if (!isOwner && !campaign.access_enabled) {
      return NextResponse.json({ error: "Shop access is disabled" }, { status: 403 })
    }

    // Get the item details
    const { data: item, error: itemError } = await supabaseAdmin
      .from("shopkeeper_inventory")
      .select("*")
      .eq("id", itemId)
      .eq("shopkeeper_id", shopkeeperId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Check stock
    if (item.stock_quantity <= 0) {
      return NextResponse.json({ error: "Item out of stock" }, { status: 400 })
    }

    // Get player's current gold
    const { data: goldData } = await supabaseAdmin
      .from("players_gold")
      .select("gold_amount")
      .eq("campaign_id", campaignId)
      .eq("player_id", user.id)
      .single()

    const currentGold = goldData?.gold_amount || 0

    // Check if player has enough gold
    if (currentGold < item.final_price) {
      return NextResponse.json(
        {
          error: "Insufficient gold",
          details: { required: item.final_price, available: currentGold },
        },
        { status: 400 },
      )
    }

    // Start transaction: reduce stock and deduct gold
    const { error: stockError } = await supabaseAdmin
      .from("shopkeeper_inventory")
      .update({ stock_quantity: item.stock_quantity - 1 })
      .eq("id", itemId)

    if (stockError) {
      return NextResponse.json({ error: "Failed to update stock" }, { status: 500 })
    }

    // Deduct gold
    const { error: goldError } = await supabaseAdmin.from("players_gold").upsert({
      player_id: user.id,
      campaign_id: campaignId,
      gold_amount: currentGold - item.final_price,
      updated_at: new Date().toISOString(),
    })

    if (goldError) {
      // Rollback stock change
      await supabaseAdmin.from("shopkeeper_inventory").update({ stock_quantity: item.stock_quantity }).eq("id", itemId)

      return NextResponse.json({ error: "Failed to process payment" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item: item.item_name,
      price: item.final_price,
      remainingGold: currentGold - item.final_price,
    })
  } catch (error) {
    console.error("Purchase error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

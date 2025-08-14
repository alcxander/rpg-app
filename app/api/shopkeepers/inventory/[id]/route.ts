import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reqId = Math.random().toString(36).substring(2, 8)

  try {
    const { id } = await params
    console.log("[api/shopkeepers/inventory] PATCH start", { reqId, inventoryId: id })

    const { userId } = getAuth(req)
    if (!userId) {
      console.log("[api/shopkeepers/inventory] PATCH unauthorized", { reqId })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body // 'increment' or 'decrement'

    if (!action || !["increment", "decrement"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // First, get the current inventory item and verify ownership/DM privileges
    const { data: inventory, error: inventoryError } = await supabase
      .from("shopkeeper_inventory")
      .select(`
        *,
        shopkeepers!inner(
          campaign_id,
          campaigns!inner(
            owner_id,
            campaign_members!inner(
              user_id,
              role
            )
          )
        )
      `)
      .eq("id", id)
      .single()

    if (inventoryError || !inventory) {
      console.log("[api/shopkeepers/inventory] PATCH inventory not found", { reqId, error: inventoryError })
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    const isOwner = inventory.shopkeepers.campaigns.owner_id === userId
    const userMembership = inventory.shopkeepers.campaigns.campaign_members.find(
      (member: any) => member.user_id === userId,
    )
    const isDM = userMembership?.role === "DM"
    const hasDMPrivileges = isOwner || isDM

    if (!hasDMPrivileges) {
      console.log("[api/shopkeepers/inventory] PATCH forbidden", {
        reqId,
        userId,
        ownerId: inventory.shopkeepers.campaigns.owner_id,
        userRole: userMembership?.role || "none",
        hasDMPrivileges,
      })
      return NextResponse.json({ error: "Forbidden - requires DM privileges" }, { status: 403 })
    }

    const currentQuantity = inventory.stock_quantity || 0
    const newQuantity = action === "increment" ? currentQuantity + 1 : Math.max(0, currentQuantity - 1) // Don't go below 0

    // Update the inventory
    const { data: updatedInventory, error: updateError } = await supabase
      .from("shopkeeper_inventory")
      .update({ stock_quantity: newQuantity })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.log("[api/shopkeepers/inventory] PATCH update error", { reqId, error: updateError })
      return NextResponse.json({ error: "Failed to update inventory" }, { status: 500 })
    }

    console.log("[api/shopkeepers/inventory] PATCH done", {
      reqId,
      inventoryId: id,
      action,
      oldQuantity: currentQuantity,
      newQuantity,
      userRole: userMembership?.role || "owner",
    })

    return NextResponse.json({
      success: true,
      item: updatedInventory,
      oldQuantity: currentQuantity,
      newQuantity,
    })
  } catch (error) {
    console.log("[api/shopkeepers/inventory] PATCH exception", { reqId, error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

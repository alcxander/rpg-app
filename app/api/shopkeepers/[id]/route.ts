import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId } = getAuth(req)
  const id = params.id
  console.log("[api/shopkeepers/:id] DELETE start", { reqId, hasUser: !!userId, id })
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const supabase = createAdminClient()

    // Fetch shopkeeper to get campaign
    const { data: shop, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id")
      .eq("id", id)
      .single()
    if (sErr || !shop) {
      console.warn("[api/shopkeepers/:id] not found", { reqId, message: sErr?.message })
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Verify ownership
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", shop.campaign_id)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Soft remove; if column missing, hard delete as fallback
    const { data: u1, error: uErr1 } = await supabase
      .from("shopkeepers")
      .update({ removed: true, removed_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single()

    if (uErr1 && String(uErr1.message).toLowerCase().includes("removed")) {
      // Fallback: delete inventory then shopkeeper
      const { error: dInv } = await supabase.from("shop_inventory").delete().eq("shopkeeper_id", id)
      if (dInv) console.error("[api/shopkeepers/:id] delete inventory error", { reqId, message: dInv.message })
      const { error: dShop } = await supabase.from("shopkeepers").delete().eq("id", id)
      if (dShop) {
        console.error("[api/shopkeepers/:id] delete shop error", { reqId, message: dShop.message })
        return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
      }
      console.log("[api/shopkeepers/:id] deleted", { reqId, id })
      return NextResponse.json({ ok: true, removed: true })
    }

    if (uErr1 || !u1) {
      console.error("[api/shopkeepers/:id] update error", { reqId, message: uErr1?.message })
      return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
    }

    console.log("[api/shopkeepers/:id] removed", { reqId, id })
    return NextResponse.json({ ok: true, removed: true })
  } catch (e: any) {
    console.error("[api/shopkeepers/:id] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

// Soft-remove a shopkeeper (owner only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const shopkeeperId = params.id
  console.log("[api/shopkeepers/:id] DELETE start", { reqId, shopkeeperId, hasUser: !!userId, sessionId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const supabase = createAdminClient()

    // Find shopkeeper and its campaign
    const { data: shop, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id,removed")
      .eq("id", shopkeeperId)
      .single()
    if (sErr || !shop) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", shop.campaign_id)
      .single()
    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: updated, error: uErr } = await supabase
      .from("shopkeepers")
      .update({ removed: true, removed_at: new Date().toISOString() })
      .eq("id", shopkeeperId)
      .select("id,removed,removed_at")
      .single()
    if (uErr || !updated) return NextResponse.json({ error: "Update failed" }, { status: 500 })

    console.log("[api/shopkeepers/:id] DELETE done", { reqId, id: updated.id, removed: updated.removed })
    return NextResponse.json({ ok: true, id: updated.id })
  } catch (e: any) {
    console.error("[api/shopkeepers/:id] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const shopkeeperId = params.id
  console.log("[api/shopkeepers/:id] DELETE start", { reqId, shopkeeperId, hasUser: !!userId, sessionId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const supabase = createAdminClient()

    // Find shopkeeper
    const { data: sk, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id,removed")
      .eq("id", shopkeeperId)
      .single()
    if (sErr || !sk) {
      console.log("[api/shopkeepers/:id] not found", { reqId, message: sErr?.message })
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Check owner of campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", sk.campaign_id)
      .single()
    if (cErr || !campaign) {
      console.log("[api/shopkeepers/:id] campaign not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign missing" }, { status: 404 })
    }
    const isOwner = campaign.owner_id === userId
    if (!isOwner) {
      console.log("[api/shopkeepers/:id] forbidden", { reqId, owner_id: campaign.owner_id, userId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Soft-remove
    const { data: upd, error: uErr } = await supabase
      .from("shopkeepers")
      .update({ removed: true, removed_at: new Date().toISOString() })
      .eq("id", shopkeeperId)
      .select("id,removed,removed_at")
      .single()
    if (uErr) {
      console.error("[api/shopkeepers/:id] update error", { reqId, message: uErr.message })
      return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
    }

    console.log("[api/shopkeepers/:id] removed", { reqId, id: upd.id })
    return NextResponse.json({ ok: true, id: upd.id, removed: upd.removed, removed_at: upd.removed_at })
  } catch (e: any) {
    console.error("[api/shopkeepers/:id] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const shopkeeperId = params.id
  console.log("[api/shopkeepers/:id] DELETE start", { reqId, hasUser: !!userId, sessionId, shopkeeperId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!shopkeeperId) return NextResponse.json({ error: "shopkeeper id required" }, { status: 400 })

  try {
    const supabase = createAdminClient()

    // Fetch shopkeeper to find campaign
    const { data: sk, error: sErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id")
      .eq("id", shopkeeperId)
      .single()
    if (sErr || !sk) {
      console.warn("[api/shopkeepers/:id] not found", { reqId, message: sErr?.message })
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Confirm ownership
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,owner_id")
      .eq("id", sk.campaign_id)
      .single()
    if (cErr || !campaign) {
      console.warn("[api/shopkeepers/:id] campaign not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    if (campaign.owner_id !== userId) {
      console.warn("[api/shopkeepers/:id] forbidden (not owner)", { reqId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Soft remove if columns exist, else delete
    const { error: uErr } = await supabase
      .from("shopkeepers")
      .update({ removed: true, removed_at: new Date().toISOString() })
      .eq("id", shopkeeperId)

    if (uErr && String(uErr.message).toLowerCase().includes("removed")) {
      const { error: dErr } = await supabase.from("shopkeepers").delete().eq("id", shopkeeperId)
      if (dErr) {
        console.error("[api/shopkeepers/:id] delete fallback error", { reqId, message: dErr.message })
        return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
      }
      console.log("[api/shopkeepers/:id] deleted (fallback)", { reqId })
      return NextResponse.json({ ok: true, removed: true, strategy: "deleted" })
    } else if (uErr) {
      console.error("[api/shopkeepers/:id] update error", { reqId, message: uErr.message })
      return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
    }

    console.log("[api/shopkeepers/:id] removed", { reqId })
    return NextResponse.json({ ok: true, removed: true, strategy: "soft" })
  } catch (e: any) {
    console.error("[api/shopkeepers/:id] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

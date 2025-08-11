import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const shopkeeperId = params.id
  try {
    const { userId } = getAuth(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabase = createAdminClient()

    // Fetch shopkeeper with campaign owner
    const { data: sk, error: skErr } = await supabase
      .from("shopkeepers")
      .select("id,campaign_id")
      .eq("id", shopkeeperId)
      .single()
    if (skErr || !sk) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", sk.campaign_id)
      .single()
    if (campErr || !camp) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (camp.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Soft remove preferred
    const { data: updated, error: updErr } = await supabase
      .from("shopkeepers")
      .update({ removed: true, removed_at: new Date().toISOString() })
      .eq("id", shopkeeperId)
      .select("id")
      .single()

    if (updErr) {
      console.warn("[api/shopkeepers.delete] soft remove failed; trying hard delete", { reqId, msg: updErr.message })
      await supabase.from("shopkeepers").delete().eq("id", shopkeeperId)
      return NextResponse.json({ ok: true })
    }

    console.log("[api/shopkeepers.delete] removed", { reqId, id: updated?.id })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[api/shopkeepers.delete] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

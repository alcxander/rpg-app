import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

function rid() {
  return Math.random().toString(36).slice(2, 8)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const campaignId = params.id
  try {
    const { userId, sessionId } = getAuth(req)
    console.log("[api/campaigns.shop-access] start", { reqId, campaignId, hasUser: !!userId, sessionId })
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { access_enabled } = await req.json().catch(() => ({ access_enabled: undefined }))
    if (typeof access_enabled !== "boolean") {
      return NextResponse.json({ error: "access_enabled boolean required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: camp, error: campErr } = await supabase
      .from("campaigns")
      .select("id,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()

    if (campErr || !camp) {
      console.warn("[api/campaigns.shop-access] not found", { reqId, campaignId, error: campErr?.message || null })
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (camp.owner_id !== userId) {
      console.warn("[api/campaigns.shop-access] forbidden", { reqId, campaignId, owner: camp.owner_id, userId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: updated, error: updErr } = await supabase
      .from("campaigns")
      .update({ access_enabled })
      .eq("id", campaignId)
      .select("id,name,owner_id,access_enabled")
      .single()

    if (updErr || !updated) {
      console.error("[api/campaigns.shop-access] update error", { reqId, error: updErr?.message || null })
      return NextResponse.json({ error: updErr?.message || "Update failed" }, { status: 500 })
    }

    console.log("[api/campaigns.shop-access] done", { reqId, campaignId, access_enabled: updated.access_enabled })
    return NextResponse.json({ campaign: updated })
  } catch (e: any) {
    console.error("[api/campaigns.shop-access] exception", { reqId, campaignId, message: e?.message })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

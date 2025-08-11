import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const campaignId = params.id
  console.log("[api/campaigns.shop-access] start", { reqId, campaignId, hasUser: !!userId, sessionId })

  if (!userId) {
    console.log("[api/campaigns.shop-access] unauthorized", { reqId })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const raw = await req.text()
    const body = raw ? JSON.parse(raw) : {}
    const access_enabled = Boolean(body?.access_enabled)
    console.log("[api/campaigns.shop-access] body", { reqId, access_enabled })

    const supabase = createAdminClient()

    // Check ownership by owner_id only
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, owner_id, access_enabled")
      .eq("id", campaignId)
      .single()

    if (cErr || !campaign) {
      console.log("[api/campaigns.shop-access] not found", { reqId, error: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const isOwner = campaign.owner_id === userId
    if (!isOwner) {
      console.log("[api/campaigns.shop-access] forbidden", { reqId, owner_id: campaign.owner_id, userId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: updated, error: uErr } = await supabase
      .from("campaigns")
      .update({ access_enabled })
      .eq("id", campaignId)
      .select("id, access_enabled")
      .single()

    if (uErr) {
      console.error("[api/campaigns.shop-access] update error", { reqId, message: uErr.message })
      return NextResponse.json({ error: "Failed to update access" }, { status: 500 })
    }

    console.log("[api/campaigns.shop-access] done", { reqId, access_enabled: updated?.access_enabled })
    return NextResponse.json({ campaign: { ...updated, isOwner: true } })
  } catch (e: any) {
    console.error("[api/campaigns.shop-access] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 })
  }
}

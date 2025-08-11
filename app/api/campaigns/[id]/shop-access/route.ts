import { NextResponse, type NextRequest } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const campaignId = params.id
  console.log("[api/campaigns.shop-access] start", { reqId, hasUser: !!userId, sessionId, campaignId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!campaignId) return NextResponse.json({ error: "campaign id required" }, { status: 400 })

  try {
    const { access_enabled } = await req.json().catch(() => ({}) as { access_enabled?: boolean })

    if (typeof access_enabled !== "boolean") {
      return NextResponse.json({ error: "access_enabled boolean required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()
    if (cErr || !campaign) {
      console.warn("[api/campaigns.shop-access] not found", { reqId, message: cErr?.message })
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    if (campaign.owner_id !== userId) {
      console.warn("[api/campaigns.shop-access] forbidden (not owner)", { reqId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: updated, error: uErr } = await supabase
      .from("campaigns")
      .update({ access_enabled })
      .eq("id", campaignId)
      .select("id,name,owner_id,access_enabled")
      .single()

    if (uErr || !updated) {
      console.error("[api/campaigns.shop-access] update error", { reqId, message: uErr?.message })
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    console.log("[api/campaigns.shop-access] done", { reqId, access_enabled: updated.access_enabled })
    return NextResponse.json({ campaign: { ...updated, isOwner: true } })
  } catch (e: any) {
    console.error("[api/campaigns.shop-access] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

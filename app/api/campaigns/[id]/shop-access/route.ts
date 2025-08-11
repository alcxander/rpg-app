import { type NextRequest, NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/lib/supabaseAdmin"

const rid = () => Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const reqId = rid()
  const { userId, sessionId } = getAuth(req)
  const campaignId = params.id
  console.log("[api/campaigns.shop-access] start", { reqId, campaignId, hasUser: !!userId, sessionId })

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { access_enabled } = (await req.json().catch(() => ({}))) as { access_enabled?: boolean }
    if (typeof access_enabled !== "boolean") {
      return NextResponse.json({ error: "access_enabled boolean required" }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id,name,owner_id,access_enabled")
      .eq("id", campaignId)
      .single()

    console.log("[api/campaigns.shop-access] lookup", {
      reqId,
      found: !!campaign,
      err: cErr?.message || null,
      owner_id: campaign?.owner_id,
    })

    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.owner_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: updated, error: uErr } = await supabase
      .from("campaigns")
      .update({ access_enabled })
      .eq("id", campaignId)
      .select("id,name,owner_id,access_enabled")
      .single()

    console.log("[api/campaigns.shop-access] update", {
      reqId,
      err: uErr?.message || null,
      access_enabled: updated?.access_enabled,
    })

    if (uErr || !updated) return NextResponse.json({ error: "Update failed" }, { status: 500 })

    return NextResponse.json({ ok: true, campaign: { ...updated, isOwner: true } })
  } catch (e: any) {
    console.error("[api/campaigns.shop-access] exception", { reqId, message: e?.message })
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 })
  }
}

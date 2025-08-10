import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabaseAdmin"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const campaignId = params.id
    const body = await req.json().catch(() => ({}))
    const access_enabled = Boolean(body.access_enabled)

    const supabase = createClient()

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, dm_id, access_enabled")
      .eq("id", campaignId)
      .single()

    if (cErr || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.dm_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: updated, error: uErr } = await supabase
      .from("campaigns")
      .update({ access_enabled })
      .eq("id", campaignId)
      .select("id, access_enabled")
      .single()

    if (uErr) throw uErr

    return NextResponse.json({ campaign: { ...updated, isOwner: true } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 })
  }
}
